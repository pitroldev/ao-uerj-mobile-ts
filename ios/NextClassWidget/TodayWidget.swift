import SwiftUI
import WidgetKit

/// "Hoje" na tela de início, como o `TodayWidget.kt` do Android: as aulas do
/// dia da grade salva, com o início, o fim, a disciplina e a sala. A aula em
/// andamento ganha o fundo suave e as que já terminaram ficam esmaecidas. O
/// toque abre o app no Início. A linha do tempo é a do "Próxima aula": um
/// desenho em cada virada de aula e à meia-noite.
struct TodayWidget: Widget {
  static let kind = "TodayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: TodayProvider()) { entry in
      TodayView(entry: entry)
    }
    .configurationDisplayName("Aulas de hoje")
    .description("As aulas do dia, com o horário e a sala, a partir da grade salva no app.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .contentMarginsDisabledIfAvailable()
  }
}

// MARK: - Linha do tempo

enum TodayState {
  /// Sem grade, grade vencida ou sem aulas hoje: o motivo.
  case message(String)
  case classes([WidgetClass])
}

struct TodayEntry: TimelineEntry {
  let date: Date
  let state: TodayState

  /// Prévia na galeria de widgets (aulas de exemplo, a primeira em andamento).
  static func preview(_ date: Date = Date()) -> TodayEntry {
    let weekday = WidgetStore.weekdayOf(date)
    let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
    let now = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    return TodayEntry(
      date: date,
      state: .classes([
        WidgetClass(
          weekday: weekday, start: now - 20, end: now + 80, startLabel: "14:20", endLabel: "16:00",
          title: "Cálculo II", detail: "T3–T4 · Sala 6019 B", place: ""),
        WidgetClass(
          weekday: weekday, start: now + 120, end: now + 230, startLabel: "17:00", endLabel: "18:50",
          title: "Circuitos Elétricos IV", detail: "T6–N1 · Sala 5032 F", place: ""),
      ])
    )
  }
}

struct TodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    .preview()
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    if context.isPreview {
      completion(.preview())
      return
    }
    let now = Date()
    completion(entry(at: now, schedule: WidgetStore.load(), signedOut: WidgetStore.signedOut))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let now = Date()
    let schedule = WidgetStore.load()
    let signedOut = WidgetStore.signedOut
    let moments = WidgetStore.changes(after: now, schedule: schedule)
    let entries = ([now] + moments).map { entry(at: $0, schedule: schedule, signedOut: signedOut) }
    completion(Timeline(entries: entries, policy: moments.isEmpty ? .never : .atEnd))
  }

  private func entry(at date: Date, schedule: WidgetSchedule?, signedOut: Bool) -> TodayEntry {
    guard let schedule = schedule else {
      return TodayEntry(date: date, state: .message(signedOut ? ClassTexts.signedOut : ClassTexts.notLoaded))
    }
    if date > schedule.expiresAt {
      return TodayEntry(date: date, state: .message(ClassTexts.outdated))
    }
    let today = WidgetStore.classes(on: date, in: schedule)
    if !today.isEmpty {
      return TodayEntry(date: date, state: .classes(today))
    }
    // sem aulas hoje: a próxima, como o card do Início
    guard let next = WidgetStore.next(schedule, at: date) else {
      return TodayEntry(date: date, state: .message(ClassTexts.noClasses))
    }
    let day = ClassTexts.weekdays[next.item.weekday - 1]
    return TodayEntry(
      date: date,
      state: .message("Sem aulas hoje. Próxima: \(day), \(next.item.startLabel) · \(next.item.title)")
    )
  }
}

// MARK: - Desenho

struct TodayView: View {
  let entry: TodayEntry

  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  private var palette: Palette { Palette.of(colorScheme) }
  /// Quantas aulas cabem: o resto vira "mais N aulas hoje".
  private var limit: Int { family == .systemLarge ? 7 : 3 }

  private var minutes: Int {
    let parts = Calendar.current.dateComponents([.hour, .minute], from: entry.date)
    return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      header
      content
      Spacer(minLength: 0)
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenText)
    .widgetURL(homeURL)
    .widgetBackground(palette.surface)
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline) {
      Text("Hoje")
        .font(.system(size: 15, weight: .semibold))
        .foregroundColor(palette.ink)
      Spacer(minLength: 8)
      Text(ClassTexts.dateLabel(entry.date))
        .font(.system(size: 13))
        .foregroundColor(palette.muted)
        .lineLimit(1)
    }
  }

  @ViewBuilder private var content: some View {
    switch entry.state {
    case let .message(text):
      Text(text)
        .font(.system(size: 13))
        .foregroundColor(palette.muted)
        .lineLimit(3)
    case let .classes(items):
      classList(items)
    }
  }

  private func classList(_ items: [WidgetClass]) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      ForEach(Array(items.prefix(limit).enumerated()), id: \.offset) { _, item in
        row(item)
      }
      if items.count > limit {
        Text(moreText(items.count - limit))
          .font(.system(size: 12))
          .foregroundColor(palette.muted)
          .padding(.leading, 8)
          .padding(.top, 2)
      }
    }
    .padding(.horizontal, -8)
  }

  private func moreText(_ count: Int) -> String {
    count == 1 ? "mais 1 aula hoje" : "mais \(count) aulas hoje"
  }

  /// Início e fim à esquerda; a disciplina e a sala ao lado.
  private func row(_ item: WidgetClass) -> some View {
    let ongoing = item.start <= minutes && minutes < item.end
    let past = item.end <= minutes
    return HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading, spacing: 0) {
        Text(item.startLabel)
          .font(.system(size: 14, weight: .medium).monospacedDigit())
          .foregroundColor(ongoing ? palette.accent : past ? palette.muted : palette.ink)
        Text("até \(item.endLabel)")
          .font(.system(size: 11).monospacedDigit())
          .foregroundColor(palette.muted)
      }
      .frame(width: 52, alignment: .leading)
      VStack(alignment: .leading, spacing: 0) {
        Text(item.title)
          .font(.system(size: 14, weight: .medium))
          .foregroundColor(past ? palette.muted : palette.ink)
          .lineLimit(1)
        if !ClassTexts.place(item).isEmpty {
          Text(ClassTexts.place(item))
            .font(.system(size: 12))
            .foregroundColor(palette.muted)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 8)
    .padding(.vertical, 5)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(ongoing ? palette.tileSoft : Color.clear))
  }

  /// Leitor de tela: "Hoje, Domingo, 25 de outubro. Agora: Cálculo II, das 14:20 às 16:00, …"
  private var spokenText: String {
    let date = "Hoje, \(ClassTexts.dateLabel(entry.date))."
    switch entry.state {
    case let .message(text):
      return "\(date) \(text)"
    case let .classes(items):
      let rows = items.map { item -> String in
        let state = item.start <= minutes && minutes < item.end
          ? "Agora: " : item.end <= minutes ? "Já terminou: " : ""
        let location = ClassTexts.place(item)
        let base = "\(state)\(item.title), das \(item.startLabel) às \(item.endLabel)"
        return location.isEmpty ? "\(base)." : "\(base), \(location)."
      }
      return ([date] + rows).joined(separator: " ")
    }
  }
}
