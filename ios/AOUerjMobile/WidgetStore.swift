import Foundation
import WidgetKit

/// Uma aula como o JS a manda: dia, minutos e os textos do card de próxima
/// aula do Início.
struct WidgetClass {
  /// 1 = segunda … 7 = domingo.
  let weekday: Int
  /// Minutos desde 0h.
  let start: Int
  let end: Int
  let startLabel: String
  let endLabel: String
  let title: String
  let detail: String
  let place: String
}

struct WidgetSchedule {
  let updatedAt: Date
  /// Depois disso o widget pede para abrir o app (a grade pode estar velha).
  let expiresAt: Date
  let classes: [WidgetClass]
}

struct NextClass {
  let item: WidgetClass
  /// 0 = hoje, 1 = amanhã … 7 = o mesmo dia na semana seguinte.
  let dayOffset: Int
  /// Acontecendo agora.
  let ongoing: Bool
}

/// A grade salva do widget "Próxima aula", como o `NextClassStore.kt` do
/// Android. O app grava (pelo `HomeWidgetModule.mm`) sempre que a grade salva
/// muda; o widget lê no App Group e escolhe a próxima aula na hora de
/// desenhar, com a regra do card do Início (`findNextClass` em
/// scheduleFormat.ts). Sem acesso ao portal.
///
/// Este arquivo entra no app e na extensão do widget.
@objc(AOWidgetStore)
public final class WidgetStore: NSObject {
  @objc public static let appGroup = "group.com.aouerjmobile"
  @objc public static let kind = "NextClassWidget"

  private static let scheduleKey = "schedule"
  /// Gravado pelo logout (a grade vazia): o widget pede o login. Sem ele e
  /// sem grade, o JS ainda não mandou nada (widget posto antes de o app abrir)
  /// ou a grade da conta não foi lida, e o widget pede para abrir o app.
  private static let signedOutKey = "signed_out"
  private static let maxClasses = 100

  private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  /// `nil` para uma grade malformada; uma aula malformada só fica de fora.
  static func parse(_ json: String) -> WidgetSchedule? {
    guard let data = json.data(using: .utf8),
      let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      let updatedAt = root["updatedAt"] as? NSNumber,
      let expiresAt = root["expiresAt"] as? NSNumber,
      let items = root["classes"] as? [Any]
    else { return nil }
    let classes = items.prefix(maxClasses).compactMap { value -> WidgetClass? in
      guard let item = value as? [String: Any],
        let weekday = (item["weekday"] as? NSNumber)?.intValue,
        let start = (item["start"] as? NSNumber)?.intValue,
        let end = (item["end"] as? NSNumber)?.intValue,
        let startLabel = item["startLabel"] as? String,
        let endLabel = item["endLabel"] as? String,
        let title = item["title"] as? String,
        (1...7).contains(weekday), (0..<24 * 60).contains(start), end > start
      else { return nil }
      return WidgetClass(
        weekday: weekday,
        start: start,
        end: end,
        startLabel: startLabel,
        endLabel: endLabel,
        title: title,
        detail: item["detail"] as? String ?? "",
        place: item["place"] as? String ?? ""
      )
    }
    return WidgetSchedule(
      updatedAt: Date(timeIntervalSince1970: updatedAt.doubleValue / 1000),
      expiresAt: Date(timeIntervalSince1970: expiresAt.doubleValue / 1000),
      classes: classes
    )
  }

  @objc public static func isValid(_ json: String) -> Bool {
    parse(json) != nil
  }

  /// Troca a grade e redesenha; texto vazio a apaga e marca o logout.
  @objc public static func replace(_ json: String) {
    guard let defaults = defaults else { return }
    if json.isEmpty {
      defaults.removeObject(forKey: scheduleKey)
    } else {
      defaults.set(json, forKey: scheduleKey)
    }
    defaults.set(json.isEmpty, forKey: signedOutKey)
    reload()
  }

  /// Conta entrou, grade ainda não lida: deixa de pedir o login; a grade salva fica.
  @objc public static func signIn() {
    defaults?.removeObject(forKey: signedOutKey)
    reload()
  }

  /// Redesenha os widgets do app ("Próxima aula" e "Hoje").
  @objc public static func reload() {
    WidgetCenter.shared.reloadAllTimelines()
  }

  static var signedOut: Bool { defaults?.bool(forKey: signedOutKey) ?? false }

  static func load() -> WidgetSchedule? {
    guard let json = defaults?.string(forKey: scheduleKey) else { return nil }
    return parse(json)
  }

  /// A aula de hoje em curso ou por vir; senão, a primeira dos dias seguintes.
  static func next(_ schedule: WidgetSchedule, at now: Date, calendar: Calendar = .current) -> NextClass? {
    let parts = calendar.dateComponents([.hour, .minute], from: now)
    let minutes = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    for offset in 0...7 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: now) else { continue }
      let weekday = weekdayOf(day, calendar: calendar)
      let item = schedule.classes
        .filter { $0.weekday == weekday && (offset != 0 || $0.end > minutes) }
        .min { $0.start < $1.start }
      if let item = item {
        return NextClass(item: item, dayOffset: offset, ongoing: offset == 0 && item.start <= minutes)
      }
    }
    return nil
  }

  /// 1 = segunda … 7 = domingo (no `Calendar`, 1 = domingo … 7 = sábado).
  static func weekdayOf(_ date: Date, calendar: Calendar = .current) -> Int {
    (calendar.component(.weekday, from: date) + 5) % 7 + 1
  }

  /// As aulas do dia de `date`, pela ordem do início.
  static func classes(on date: Date, in schedule: WidgetSchedule, calendar: Calendar = .current) -> [WidgetClass] {
    let weekday = weekdayOf(date, calendar: calendar)
    return schedule.classes.filter { $0.weekday == weekday }.sorted { $0.start < $1.start }
  }

  /// O que mostrar em `date`: um aviso (sem conta, sem grade, grade vencida, sem aulas) ou a próxima aula.
  static func lookup(at date: Date, schedule: WidgetSchedule?, signedOut: Bool) -> ClassLookup {
    guard let schedule = schedule else {
      // logout, ou nada recebido ainda: widget posto antes de o app abrir, ou
      // conta com a grade não lida
      return .message(title: "Próxima aula", text: signedOut ? ClassTexts.signedOut : ClassTexts.notLoaded)
    }
    if date > schedule.expiresAt {
      return .message(title: "Próxima aula", text: ClassTexts.outdated)
    }
    guard let next = Self.next(schedule, at: date) else {
      return .message(title: ClassTexts.noClassesTitle, text: ClassTexts.noClasses)
    }
    return .next(next)
  }

  /// O mesmo, com a grade e o logout salvos no App Group.
  static func lookup(at date: Date) -> ClassLookup {
    lookup(at: date, schedule: load(), signedOut: signedOut)
  }

  /**
   * Os momentos em que um widget muda nas próximas 48 horas: cada aula começa
   * ("Agora") ou termina, a meia-noite (o rótulo do dia) e o vencimento da
   * grade. No fim deles, o WidgetKit pede outra linha do tempo.
   */
  static func changes(after now: Date, schedule: WidgetSchedule?, calendar: Calendar = .current) -> [Date] {
    guard let schedule = schedule, now <= schedule.expiresAt else { return [] }
    let today = calendar.startOfDay(for: now)
    let horizon = now.addingTimeInterval(48 * 60 * 60)
    var moments: [Date] = [schedule.expiresAt.addingTimeInterval(1)]
    for offset in 0...2 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
      if offset > 0 { moments.append(day) }
      let weekday = weekdayOf(day, calendar: calendar)
      for item in schedule.classes where item.weekday == weekday {
        moments.append(day.addingTimeInterval(TimeInterval(item.start * 60)))
        moments.append(day.addingTimeInterval(TimeInterval(item.end * 60)))
      }
    }
    return Array(Set(moments.filter { $0 > now && $0 <= horizon })).sorted()
  }
}

/// O que um widget ou um intent mostra num momento.
enum ClassLookup {
  /// Sem aula para mostrar: um título e o motivo.
  case message(title: String, text: String)
  case next(NextClass)
}

/// Os textos das aulas, os mesmos dos widgets do Android (strings.xml).
enum ClassTexts {
  static let weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
  static let weekdaysShort = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
  static let signedOut = "Entre no AO UERJ para ver suas aulas."
  static let notLoaded = "Abra o AO UERJ para carregar a grade."
  static let outdated = "Abra o AO UERJ para atualizar a grade."
  static let noClassesTitle = "Sem aulas na grade"
  static let noClasses = "Nenhuma disciplina em curso com horário."

  /// "Agora", "Hoje" ou o dia da semana (inteiro, ou o "Seg" do bloco).
  static func dayLabel(_ next: NextClass, short: Bool) -> String {
    if next.ongoing { return "Agora" }
    if next.dayOffset == 0 { return "Hoje" }
    return (short ? weekdaysShort : weekdays)[next.item.weekday - 1]
  }

  /// "até 18:50 · T6–N1 · Sala 6019 B", ou só "até 18:50".
  static func detail(_ item: WidgetClass) -> String {
    item.detail.isEmpty ? "até \(item.endLabel)" : "até \(item.endLabel) · \(item.detail)"
  }

  /// "T6–N1 · Sala 6019 B, Pav. João Lyra Filho": a sala e o local, sem o horário.
  static func place(_ item: WidgetClass) -> String {
    [item.detail, item.place].filter { !$0.isEmpty }.joined(separator: ", ")
  }

  /// Leitor de tela e Siri: "Próxima aula, Hoje: Cálculo II, das 14:20 às 16:00, T3–T4 · Sala 6019 B."
  static func describe(_ next: NextClass) -> String {
    let item = next.item
    let base = "Próxima aula, \(dayLabel(next, short: false)): \(item.title), das \(item.startLabel) às \(item.endLabel)"
    let location = place(item)
    return location.isEmpty ? "\(base)." : "\(base), \(location)."
  }

  /// "Domingo, 25 de outubro".
  static func dateLabel(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "pt_BR")
    formatter.dateFormat = "EEEE, d 'de' MMMM"
    let text = formatter.string(from: date)
    return text.prefix(1).uppercased() + text.dropFirst()
  }
}
