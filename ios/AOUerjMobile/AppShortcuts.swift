import AppIntents
import Foundation

/// "Próxima aula" pela Siri, pelo app Atalhos e pelo Spotlight: responde com a
/// grade salva (a mesma dos widgets, no App Group), sem abrir o app nem o portal.
@available(iOS 16.0, *)
struct NextClassIntent: AppIntent {
  static let title: LocalizedStringResource = "Próxima aula"
  static let description = IntentDescription(
    "Diz qual é a sua próxima aula, com o horário e a sala, pela grade salva no app.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let text: String
    switch WidgetStore.lookup(at: Date()) {
    case let .message(_, message):
      text = message
    case let .next(next):
      text = ClassTexts.describe(next)
    }
    return .result(dialog: "\(text)")
  }
}

/// "Aulas de hoje": todas as do dia, ou a próxima quando hoje não há aula.
@available(iOS 16.0, *)
struct TodayClassesIntent: AppIntent {
  static let title: LocalizedStringResource = "Aulas de hoje"
  static let description = IntentDescription(
    "Lista as aulas de hoje, com o horário e a sala, pela grade salva no app.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let text = TodaySummary.text(at: Date())
    return .result(dialog: "\(text)")
  }
}

/// O texto de "Aulas de hoje", com os avisos dos widgets quando falta a grade.
enum TodaySummary {
  static func text(at date: Date) -> String {
    guard let schedule = WidgetStore.load() else {
      return WidgetStore.signedOut ? ClassTexts.signedOut : ClassTexts.notLoaded
    }
    if date > schedule.expiresAt { return ClassTexts.outdated }
    let today = WidgetStore.classes(on: date, in: schedule)
    if today.isEmpty {
      guard let next = WidgetStore.next(schedule, at: date) else { return ClassTexts.noClasses }
      let day = ClassTexts.weekdays[next.item.weekday - 1]
      return "Sem aulas hoje. Próxima: \(day), \(next.item.startLabel) · \(next.item.title)."
    }
    let items = today.map { item -> String in
      let location = ClassTexts.place(item)
      let base = "\(item.title), das \(item.startLabel) às \(item.endLabel)"
      return location.isEmpty ? base : "\(base), \(location)"
    }
    let count = today.count == 1 ? "1 aula" : "\(today.count) aulas"
    return "Hoje você tem \(count): \(items.joined(separator: "; "))."
  }
}

/// Frases prontas para a Siri e atalhos no app Atalhos e no Spotlight.
@available(iOS 17.0, *)
struct AOUerjShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NextClassIntent(),
      phrases: [
        "Próxima aula no \(.applicationName)",
        "Qual é a minha próxima aula no \(.applicationName)",
      ],
      shortTitle: "Próxima aula",
      systemImageName: "calendar.badge.clock"
    )
    AppShortcut(
      intent: TodayClassesIntent(),
      phrases: [
        "Aulas de hoje no \(.applicationName)",
        "Quais são as minhas aulas hoje no \(.applicationName)",
      ],
      shortTitle: "Aulas de hoje",
      systemImageName: "list.bullet.rectangle"
    )
    AppShortcut(
      intent: OpenAppAreaIntent(),
      phrases: [
        "Abrir \(\.$target) no \(.applicationName)",
        "Abrir o \(.applicationName)",
      ],
      shortTitle: "Abrir no AO UERJ",
      systemImageName: "arrow.up.forward.app"
    )
  }
}
