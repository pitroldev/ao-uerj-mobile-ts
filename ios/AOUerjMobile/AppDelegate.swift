import BackgroundTasks
internal import Expo
import React
import React_RCTAppDelegate
import UIKit
import UserNotifications
import os

/// A abertura do processo. A janela fica na `SceneDelegate` (Info.plist,
/// UIApplicationSceneManifest), como no template do React Native 0.88, e o
/// React Native na `AppReactNative` (SceneDelegate.swift), que a verificação
/// em segundo plano também abre, sem janela.
///
/// Como no template do Expo SDK 58 (ciclo de vida com cenas), o `AppDelegate`
/// é um `ExpoAppDelegate`, que repassa os eventos do app aos módulos do Expo,
/// e entrega a fábrica do React Native criada na abertura
/// (`ExpoReactNativeFactoryProvider`).
@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  /// A janela da cena, espelhada aqui para quem a procura no delegate do app.
  var window: UIWindow?

  var reactNativeFactory: RCTReactNativeFactory? {
    AppReactNative.shared.factory
  }

  var reactNativeFactoryModuleName: String {
    AppReactNative.moduleName
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Remove cached legacy AO login URLs before a React networking session starts.
    // Credentials and account preferences live in separate, untouched stores.
    URLCache.shared.removeAllCachedResponses()

    // antes de terminar a abertura, para receber o toque no aviso que abriu o app
    UNUserNotificationCenter.current().delegate = LaunchCenter.shared

    // também antes de terminar a abertura, como o BGTaskScheduler exige
    BackgroundCheck.shared.register()

    // a fábrica do React Native e o expo-updates, que começa a escolher o
    // pacote JS antes de a cena se conectar
    AppReactNative.shared.prepare()

    let launched = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // Teste do CI (scripts/ci/ios-smoke.sh): uma rodada pelo mesmo caminho,
    // sem o BGTaskScheduler, que o simulador não roda.
    if BackgroundCheck.smokeRun {
      BackgroundCheck.shared.runSmokeRound()
    }

    return launched
  }
}

/// A verificação de avisos em segundo plano no iPhone, como o
/// `PortalCheckWorker.kt` do Android, nos limites do iOS: o BGTaskScheduler
/// (BGAppRefreshTask) acorda o app quando o iOS quer, nunca antes do horário
/// pedido, e dá uns 30 segundos. O iOS guarda um só pedido desse tipo por
/// app: a tarefa `identifier` leva os dois modos da tarefa sem tela, `return`
/// ("Avisar quando voltar") e `check` (a verificação no portal). Cada modo tem
/// a próxima vez no UserDefaults, e o pedido ao iOS é a mais próxima, fora das
/// 22h às 7h.
///
/// Numa rodada, o React Native começa sem janela se o app estava fechado
/// (`AppReactNative`), a rodada espera o JS assinar os eventos (`listen`, pelo
/// AppNotificationsModule.mm) e o JS a encerra (`complete`). Quando o tempo
/// do iOS acaba, o JS é avisado para parar, e a rodada termina mesmo sem ele.
@objc(AOBackgroundCheck)
public final class BackgroundCheck: NSObject {
  @objc public static let shared = BackgroundCheck()

  /// O mesmo de BGTaskSchedulerPermittedIdentifiers, no Info.plist.
  static let identifier = "com.aouerjmobile.portal-check"

  /// O teste do CI (`runSmokeRound`). Só o simctl (SIMCTL_CHILD_…) ou o
  /// depurador definem a variável: o app aberto pelo aluno nunca a recebe.
  static let smokeRun = ProcessInfo.processInfo.environment["AO_SMOKE_BACKGROUND_CHECK"] == "1"

  private static let log = Logger(subsystem: "com.aouerjmobile", category: "background")

  /// No log do sistema; no teste do CI, também na saída de erro, que o simctl
  /// grava num arquivo. Sem dados do aluno: só ids, modos e motivos.
  static func trace(_ line: String) {
    log.notice("\(line, privacy: .public)")
    if smokeRun {
      try? FileHandle.standardError.write(contentsOf: Data("AOBackground: \(line)\n".utf8))
    }
  }

  /// Os modos de src/app/background/backgroundRounds.ts.
  private enum Mode {
    static let check = "check"
    static let portalReturn = "return"
  }

  /// O que sobrevive ao processo: o iOS abre o app do zero para a rodada.
  /// Horários em segundos desde 1970.
  private enum Key {
    /// Horas entre as verificações; sem a chave, desligada.
    static let checkInterval = "ao.background.checkInterval"
    static let checkDue = "ao.background.checkDue"
    /// Sem a chave, "Avisar quando voltar" está desligado.
    static let returnDue = "ao.background.returnDue"
    static let returnSince = "ao.background.returnSince"
  }

  /// "Avisar quando voltar": o mínimo entre as rodadas, como no WorkManager.
  private static let returnInterval: TimeInterval = 15 * 60
  /// O pedido vence em 3 dias (REQUEST_MAX_AGE do PortalReturnAlert.ts),
  /// mesmo que o JS nunca chegue a rodar.
  private static let returnMaxAge: TimeInterval = 3 * 24 * 60 * 60
  /// A primeira verificação espera uma hora, como no Android: ela é ligada
  /// com o app na tela.
  private static let firstCheckDelay: TimeInterval = 60 * 60
  /// Os limites do Android (AppNotificationsModule.kt).
  private static let minIntervalHours = 1.0
  private static let maxIntervalHours = 24.0
  /// Com a tela bloqueada, a senha salva (Keychain, só com o aparelho
  /// desbloqueado) não abre: a rodada fica para logo mais.
  private static let lockedRetry: TimeInterval = 15 * 60
  /// O que venceria até lá vai junto, na mesma rodada.
  private static let batchWindow: TimeInterval = 15 * 60
  /// Depois do aviso de expiração, o tempo do JS para parar e encerrar.
  private static let expirationGrace: TimeInterval = 2
  /// O teste do CI não tem a expiração do iOS: sem resposta do JS, falha.
  private static let smokeTimeout: TimeInterval = 40
  /// Das 22h às 7h, nada (isQuietTime em src/modules/notifications/domain/checkState.ts).
  private static let quietStartHour = 22
  private static let quietEndHour = 7

  /// Uma rodada: a do BGTaskScheduler ou, no teste do CI, sem tarefa.
  private final class Round {
    let id: String
    let modes: [String]
    let task: BGTask?
    var delivered = false
    var finished = false

    init(id: String, modes: [String], task: BGTask?) {
      self.id = id
      self.modes = modes
      self.task = task
    }
  }

  private let defaults = UserDefaults.standard
  /// Os pedidos ao BGTaskScheduler saem em ordem, fora da thread principal.
  private let scheduler = DispatchQueue(label: "com.aouerjmobile.background")

  // Na thread principal.
  /// Rodadas que esperam o JS assinar os eventos.
  private var waiting: [Round] = []
  /// Rodadas em curso, pelo id.
  private var rounds: [String: Round] = [:]
  /// Do módulo dos avisos; cada bloco diz se o evento saiu (o módulo pode já
  /// ter sido trocado num reload).
  private var deliverToJS: ((NSDictionary) -> Bool)?
  private var expireInJS: ((String) -> Bool)?

  // MARK: - BGTaskScheduler

  /// No `didFinishLaunching`: o iOS só entrega a tarefa a quem a registrou
  /// antes de a abertura terminar.
  func register() {
    let registered = BGTaskScheduler.shared.register(
      forTaskWithIdentifier: Self.identifier, using: DispatchQueue.main
    ) { [weak self] task in
      guard let self, let refresh = task as? BGAppRefreshTask else {
        task.setTaskCompleted(success: false)
        return
      }
      self.handle(refresh)
    }
    if !registered {
      Self.trace("o BGTaskScheduler recusou o registro da verificação")
    }
  }

  /// Uma rodada do iOS (na thread principal). Antes de abrir o React Native,
  /// decide com o que está no aparelho, como o Android: horário, tela
  /// bloqueada e permissão de avisos. O JS confere o resto.
  private func handle(_ task: BGAppRefreshTask) {
    let now = Date()
    let modes = takeDueModes(at: now)
    let round = Round(id: UUID().uuidString, modes: modes, task: task)
    task.expirationHandler = { [weak self] in
      DispatchQueue.main.async { self?.expire(round) }
    }
    // o próximo pedido sai já, como a Apple recomenda: a rodada pode ser
    // interrompida a qualquer momento
    defer { submit() }
    if modes.isEmpty {
      finish(round, success: true, by: "nada venceu")
      return
    }
    if Self.isQuietTime(now) {
      finish(round, success: true, by: "das 22h às 7h")
      return
    }
    guard UIApplication.shared.isProtectedDataAvailable else {
      postpone(modes, to: now.addingTimeInterval(Self.lockedRetry))
      finish(round, success: false, by: "tela bloqueada")
      return
    }
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      DispatchQueue.main.async {
        guard !round.finished else { return }
        guard Self.allowsAlerts(settings.authorizationStatus) else {
          self.finish(round, success: true, by: "sem permissão")
          return
        }
        self.start(round)
      }
    }
  }

  /// O teste do CI (scripts/ci/ios-smoke.sh): uma rodada pelo mesmo caminho,
  /// sem o BGTaskScheduler e sem as condições do aparelho (horário,
  /// permissão, tela bloqueada). Sem conta, o JS encerra logo. Chamada no
  /// `didFinishLaunching`, antes de a cena se conectar: o React Native começa
  /// sem janela, e a cena usa o mesmo.
  func runSmokeRound() {
    let round = Round(id: "smoke", modes: [Mode.portalReturn, Mode.check], task: nil)
    start(round)
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.smokeTimeout) { [weak self] in
      self?.finish(round, success: false, by: "tempo esgotado")
    }
  }

  private func start(_ round: Round) {
    rounds[round.id] = round
    waiting.append(round)
    // com o app fechado, o React Native começa aqui; a cena que se conectar
    // depois usa o mesmo
    AppReactNative.shared.startWithoutWindow()
    flush()
  }

  /// Entrega ao JS as rodadas que esperavam, se ele já assina os eventos.
  private func flush() {
    guard let deliver = deliverToJS else { return }
    while let round = waiting.first {
      let payload: NSDictionary = ["id": round.id, "modes": round.modes]
      guard deliver(payload) else { return }
      waiting.removeFirst()
      round.delivered = true
      Self.trace("rodada \(round.id) entregue ao JS: \(round.modes.joined(separator: ","))")
    }
  }

  /// O tempo do iOS acabou: o JS para e encerra; se não encerrar logo, a
  /// rodada termina aqui (o iOS fecharia o app).
  private func expire(_ round: Round) {
    guard !round.finished else { return }
    guard round.delivered, let notify = expireInJS, notify(round.id) else {
      finish(round, success: false, by: "expiração")
      return
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.expirationGrace) { [weak self] in
      self?.finish(round, success: false, by: "expiração")
    }
  }

  /// `reason`: quem encerrou ("JS", "expiração"…), para o log e o teste do CI.
  private func finish(_ round: Round, success: Bool, by reason: String) {
    guard !round.finished else { return }
    round.finished = true
    rounds[round.id] = nil
    waiting.removeAll { $0 === round }
    Self.trace("rodada \(round.id) encerrada: \(reason) (success=\(success ? 1 : 0))")
    round.task?.setTaskCompleted(success: success)
  }

  // MARK: - Pedidos ao iOS

  /// Os modos que venceram (ou vencem logo), já com a próxima vez de cada um.
  private func takeDueModes(at now: Date) -> [String] {
    let time = now.timeIntervalSince1970
    let limit = time + Self.batchWindow
    var modes: [String] = []
    if returnWatchOn(at: time), defaults.double(forKey: Key.returnDue) <= limit {
      modes.append(Mode.portalReturn)
      defaults.set(time + Self.returnInterval, forKey: Key.returnDue)
    }
    let hours = defaults.double(forKey: Key.checkInterval)
    if hours > 0, defaults.double(forKey: Key.checkDue) <= limit {
      modes.append(Mode.check)
      defaults.set(time + hours * 3600, forKey: Key.checkDue)
    }
    return modes
  }

  private func postpone(_ modes: [String], to date: Date) {
    let time = date.timeIntervalSince1970
    if modes.contains(Mode.portalReturn) {
      defaults.set(time, forKey: Key.returnDue)
    }
    if modes.contains(Mode.check) {
      defaults.set(time, forKey: Key.checkDue)
    }
  }

  /// "Avisar quando voltar" segue pedido; depois de 3 dias, sai.
  private func returnWatchOn(at time: TimeInterval) -> Bool {
    guard defaults.double(forKey: Key.returnDue) > 0 else { return false }
    guard time - defaults.double(forKey: Key.returnSince) <= Self.returnMaxAge else {
      clearReturnWatch()
      return false
    }
    return true
  }

  private func clearReturnWatch() {
    defaults.removeObject(forKey: Key.returnDue)
    defaults.removeObject(forKey: Key.returnSince)
  }

  /// A próxima vez mais próxima entre os modos ligados, fora das 22h às 7h;
  /// `nil` sem nenhum.
  private func nextBeginDate() -> Date? {
    var dues: [TimeInterval] = []
    if returnWatchOn(at: Date().timeIntervalSince1970) {
      dues.append(defaults.double(forKey: Key.returnDue))
    }
    if defaults.double(forKey: Key.checkInterval) > 0 {
      dues.append(defaults.double(forKey: Key.checkDue))
    }
    guard let earliest = dues.min() else { return nil }
    let soonest = Date().addingTimeInterval(60)
    return Self.outsideQuietTime(max(Date(timeIntervalSince1970: earliest), soonest))
  }

  /// Pede ao iOS a próxima rodada (o pedido novo substitui o anterior) ou a
  /// cancela, quando nada está ligado.
  private func submit() {
    let date = nextBeginDate()
    scheduler.async {
      guard let beginDate = date else {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier)
        return
      }
      let request = BGAppRefreshTaskRequest(identifier: Self.identifier)
      request.earliestBeginDate = beginDate
      do {
        try BGTaskScheduler.shared.submit(request)
      } catch {
        // no simulador, o BGTaskScheduler não existe
        Self.trace("o iOS recusou o pedido da rodada: \(error.localizedDescription)")
      }
    }
  }

  private static func isQuietTime(_ date: Date) -> Bool {
    let hour = Calendar.current.component(.hour, from: date)
    return hour >= quietStartHour || hour < quietEndHour
  }

  /// Das 22h às 7h, a rodada passa para as 7h.
  private static func outsideQuietTime(_ date: Date) -> Date {
    guard isQuietTime(date) else { return date }
    let calendar = Calendar.current
    let day =
      calendar.component(.hour, from: date) >= quietStartHour
      ? calendar.date(byAdding: .day, value: 1, to: date) ?? date
      : date
    return calendar.date(bySettingHour: quietEndHour, minute: 0, second: 0, of: day) ?? date
  }

  private static func allowsAlerts(_ status: UNAuthorizationStatus) -> Bool {
    status == .authorized || status == .provisional || status == .ephemeral
  }

  // MARK: - Módulo dos avisos (AppNotificationsModule.mm)

  /// Liga (a cada `intervalHours`, no mínimo) ou desliga a verificação no
  /// portal. Reabrir o app não recomeça a contagem, como o UPDATE do
  /// WorkManager.
  @objc(setPortalCheck:intervalHours:)
  public func setPortalCheck(_ enabled: Bool, intervalHours: Double) {
    DispatchQueue.main.async {
      if enabled {
        let now = Date().timeIntervalSince1970
        let hours = min(max(intervalHours, Self.minIntervalHours), Self.maxIntervalHours)
        let wasOn = self.defaults.double(forKey: Key.checkInterval) > 0
        let due =
          wasOn
          ? min(self.defaults.double(forKey: Key.checkDue), now + hours * 3600)
          : now + Self.firstCheckDelay
        self.defaults.set(hours, forKey: Key.checkInterval)
        self.defaults.set(due, forKey: Key.checkDue)
      } else {
        self.defaults.removeObject(forKey: Key.checkInterval)
        self.defaults.removeObject(forKey: Key.checkDue)
      }
      self.submit()
    }
  }

  /// Liga ou desliga "Avisar quando voltar": a primeira rodada a partir de 15
  /// minutos, como no Android.
  @objc(setReturnWatch:)
  public func setReturnWatch(_ enabled: Bool) {
    DispatchQueue.main.async {
      if enabled {
        let now = Date().timeIntervalSince1970
        self.defaults.set(now, forKey: Key.returnSince)
        self.defaults.set(now + Self.returnInterval, forKey: Key.returnDue)
      } else {
        self.clearReturnWatch()
      }
      self.submit()
    }
  }

  /// O JS já assina os eventos: as rodadas que esperavam saem agora, e as
  /// próximas, na hora.
  @objc(listen:expire:)
  public func listen(
    _ deliver: @escaping (NSDictionary) -> Bool, expire: @escaping (String) -> Bool
  ) {
    DispatchQueue.main.async {
      self.deliverToJS = deliver
      self.expireInJS = expire
      self.flush()
    }
  }

  /// A rodada `id` terminou no JS.
  @objc(complete:success:)
  public func complete(_ id: String, success: Bool) {
    DispatchQueue.main.async {
      guard let round = self.rounds[id] else { return }
      self.finish(round, success: success, by: "JS")
    }
  }
}
