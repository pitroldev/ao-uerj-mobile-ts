import SwiftUI
import WidgetKit

/// "Próxima aula" na tela de início, como o `NextClassWidget.kt` do Android:
/// a próxima aula da grade salva (`WidgetStore`), com o horário e a sala, como
/// o card do Início. O toque abre o app no Início.
///
/// A linha do tempo já traz um desenho para cada virada (a aula começa ou
/// termina, a meia-noite muda o rótulo do dia, a grade vence), sem acordar o
/// app; o app pede um redesenho quando manda uma grade nova.
struct NextClassWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: WidgetStore.kind, provider: NextClassProvider()) { entry in
      NextClassView(entry: entry)
    }
    .configurationDisplayName("Próxima aula")
    .description("Sua próxima aula, com o horário e a sala, a partir da grade salva no app.")
    .supportedFamilies(Self.families)
    .contentMarginsDisabledIfAvailable()
  }

  private static var families: [WidgetFamily] {
    if #available(iOSApplicationExtension 16.0, *) {
      return [.systemSmall, .systemMedium, .accessoryRectangular]
    }
    return [.systemSmall, .systemMedium]
  }
}

// MARK: - Linha do tempo

struct NextClassEntry: TimelineEntry {
  let date: Date
  let state: ClassLookup

  /// Prévia na galeria de widgets (aula de exemplo).
  static func preview(_ date: Date = Date()) -> NextClassEntry {
    let item = WidgetClass(
      weekday: WidgetStore.weekdayOf(date),
      start: 14 * 60 + 20,
      end: 16 * 60,
      startLabel: "14:20",
      endLabel: "16:00",
      title: "Cálculo II",
      detail: "T3–T4 · Sala 6019 B",
      place: "Pav. João Lyra Filho · 6º andar"
    )
    return NextClassEntry(date: date, state: .next(NextClass(item: item, dayOffset: 0, ongoing: false)))
  }
}

struct NextClassProvider: TimelineProvider {
  func placeholder(in context: Context) -> NextClassEntry {
    .preview()
  }

  func getSnapshot(in context: Context, completion: @escaping (NextClassEntry) -> Void) {
    if context.isPreview {
      completion(.preview())
      return
    }
    let now = Date()
    completion(NextClassEntry(date: now, state: WidgetStore.lookup(at: now)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NextClassEntry>) -> Void) {
    let now = Date()
    let schedule = WidgetStore.load()
    let signedOut = WidgetStore.signedOut
    let moments = WidgetStore.changes(after: now, schedule: schedule)
    let entries = ([now] + moments).map {
      NextClassEntry(date: $0, state: WidgetStore.lookup(at: $0, schedule: schedule, signedOut: signedOut))
    }
    // sem grade, nada muda até o app mandar uma (ele pede o redesenho)
    completion(Timeline(entries: entries, policy: moments.isEmpty ? .never : .atEnd))
  }
}

// MARK: - Desenho

struct NextClassView: View {
  let entry: NextClassEntry

  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  private var palette: Palette { Palette.of(colorScheme) }

  var body: some View {
    content
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(spokenText)
      .widgetURL(homeURL)
      .widgetBackground(palette.surface)
  }

  private var spokenText: String {
    switch entry.state {
    case let .message(title, text): return "\(title). \(text)"
    case let .next(next): return ClassTexts.describe(next)
    }
  }

  private var onLockScreen: Bool {
    if #available(iOSApplicationExtension 16.0, *) {
      return family == .accessoryRectangular
    }
    return false
  }

  @ViewBuilder private var content: some View {
    if onLockScreen {
      lockScreen
    } else if family == .systemSmall {
      VStack(alignment: .leading, spacing: 10) {
        tile
        texts(titleLines: 2)
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .padding(14)
    } else {
      HStack(spacing: 12) {
        tile
        texts(titleLines: 2)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .padding(16)
    }
  }

  /// À esquerda (ou no alto), o dia e o início; a aula de hoje ganha o bloco cheio.
  @ViewBuilder private var tile: some View {
    switch entry.state {
    case .message:
      Image(systemName: "calendar.badge.clock")
        .font(.system(size: 22, weight: .regular))
        .foregroundColor(palette.accent)
        .frame(width: 52, height: 52)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(palette.tileSoft))
    case let .next(next):
      classTile(next, today: next.dayOffset == 0)
    }
  }

  private func classTile(_ next: NextClass, today: Bool) -> some View {
    VStack(spacing: 1) {
      Text(ClassTexts.dayLabel(next, short: true).uppercased())
        .font(.system(size: 10, weight: .medium))
        .kerning(0.6)
        .foregroundColor(today ? palette.onTileStrongMuted : palette.accent)
      Text(next.item.startLabel)
        .font(.system(size: 16, weight: .medium).monospacedDigit())
        .foregroundColor(today ? palette.onTileStrong : palette.accent)
    }
    .lineLimit(1)
    .minimumScaleFactor(0.7)
    .frame(width: 52, height: 52)
    .background(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(today ? palette.tileStrong : palette.tileSoft))
  }

  /// A disciplina, o fim da aula com os tempos e a sala, e o local.
  @ViewBuilder private func texts(titleLines: Int) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      switch entry.state {
      case let .message(title, text):
        Text(title)
          .font(.system(size: 15, weight: .semibold))
          .foregroundColor(palette.ink)
          .lineLimit(1)
        Text(text)
          .font(.system(size: 13))
          .foregroundColor(palette.muted)
          .lineLimit(3)
      case let .next(next):
        Text(next.item.title)
          .font(.system(size: 15, weight: .semibold))
          .foregroundColor(palette.ink)
          .lineLimit(titleLines)
        Text(ClassTexts.detail(next.item))
          .font(.system(size: 13))
          .foregroundColor(palette.muted)
          .lineLimit(1)
        if !next.item.place.isEmpty {
          Text(next.item.place)
            .font(.system(size: 12))
            .foregroundColor(palette.muted)
            .lineLimit(1)
        }
      }
    }
  }

  /// Na tela bloqueada: "HOJE · 14:20", a disciplina e o fim com a sala.
  private var lockScreen: some View {
    VStack(alignment: .leading, spacing: 1) {
      switch entry.state {
      case let .message(title, text):
        Text(title).font(.headline).lineLimit(1)
        Text(text).font(.caption).lineLimit(2)
      case let .next(next):
        Text("\(ClassTexts.dayLabel(next, short: false).uppercased()) · \(next.item.startLabel)")
          .font(.caption2.weight(.semibold))
          .lineLimit(1)
        Text(next.item.title).font(.headline).lineLimit(1)
        Text(ClassTexts.detail(next.item)).font(.caption).lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}
