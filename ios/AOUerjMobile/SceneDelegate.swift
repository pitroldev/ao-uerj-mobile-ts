import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import UIKit

/// A janela do app no ciclo de vida com cenas (UIScene), o do template do
/// React Native 0.88 e o que o SDK do iOS 27 exige. Também recebe as
/// aberturas que, com cenas, não passam mais pelo `AppDelegate`: o atalho
/// do ícone e o toque no widget, na abertura e com o app aberto. O React
/// Native fica na `AppReactNative`: a cena só lhe dá a janela.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    // o app abriu por um atalho do ícone ou pelo widget
    if let shortcutItem = connectionOptions.shortcutItem {
      LaunchCenter.shared.open(shortcutItem.type)
    }
    openTarget(from: connectionOptions.urlContexts)

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    AppReactNative.shared.start(in: window, connectionOptions: connectionOptions)
  }

  // Atalho do ícone (Info.plist, UIApplicationShortcutItems) com o app aberto: o tipo é o destino.
  func windowScene(
    _ windowScene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    LaunchCenter.shared.open(shortcutItem.type)
    completionHandler(true)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    if !openTarget(from: URLContexts) {
      RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  /// Toque no widget: aouerj://open?target=home. O JS confere o destino.
  @discardableResult
  private func openTarget(from contexts: Set<UIOpenURLContext>) -> Bool {
    for context in contexts {
      let url = context.url
      guard url.scheme == "aouerj", url.host == "open",
        let target = URLComponents(url: url, resolvingAgainstBaseURL: false)?
          .queryItems?.first(where: { $0.name == "target" })?.value
      else { continue }
      LaunchCenter.shared.open(target)
      return true
    }
    return false
  }
}

/// O React Native do processo: uma fábrica e um host só, para a janela e para
/// a verificação em segundo plano (`BackgroundCheck`, no AppDelegate.swift).
///
/// Com o app fechado, o iOS abre o processo para a rodada sem conectar
/// nenhuma cena: `startWithoutWindow` abre o host sem tela (o JS roda, sem a
/// árvore do React). Se o aluno abrir o app em seguida, a cena chama `start`,
/// e a fábrica, que já tem o host (`RCTRootViewFactory.reactHost`), cria a
/// tela nele em vez de abrir um segundo: o mesmo runtime, a mesma sessão do
/// portal e o mesmo cache. As opções de abertura da cena (link, atividade)
/// não chegam a esse host; os destinos do app passam pela `LaunchCenter`.
final class AppReactNative: RCTDefaultReactNativeFactoryDelegate {
  static let shared = AppReactNative()

  private var factory: RCTReactNativeFactory?
  /// O host já começou, com a janela ou sem ela.
  private var started = false

  private func sharedFactory() -> RCTReactNativeFactory {
    if let existing = factory {
      return existing
    }
    dependencyProvider = RCTAppDependencyProvider()
    let created = RCTReactNativeFactory(delegate: self)
    factory = created
    return created
  }

  /// A tela, na janela da cena; com o host já aberto, nele.
  func start(in window: UIWindow, connectionOptions: UIScene.ConnectionOptions) {
    if started {
      BackgroundCheck.trace("cena conectada: usa o React Native já aberto")
    }
    started = true
    sharedFactory().startReactNative(
      withModuleName: "aouerjmobile",
      in: window,
      connectionOptions: connectionOptions
    )
  }

  /// O host sem janela, para a rodada em segundo plano. Fica na categoria
  /// `ao_startReactNativeWithoutWindow` do AppNotificationsModule.mm, chamada
  /// pelo nome: o método da fábrica usa tipos que o Swift não enxerga.
  func startWithoutWindow() {
    guard !started else { return }
    let factory = sharedFactory()
    let selector = NSSelectorFromString("ao_startReactNativeWithoutWindow")
    guard factory.responds(to: selector) else {
      BackgroundCheck.trace("o React Native não abriu sem janela: falta a categoria da fábrica")
      return
    }
    started = true
    _ = factory.perform(selector)
    BackgroundCheck.trace("React Native aberto sem janela")
  }

  // Mantém o BootSplash.storyboard sobre a view raiz até o JS chamar BootSplash.hide().
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
