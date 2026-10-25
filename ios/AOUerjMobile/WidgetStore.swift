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

  @objc public static func reload() {
    WidgetCenter.shared.reloadTimelines(ofKind: kind)
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
}
