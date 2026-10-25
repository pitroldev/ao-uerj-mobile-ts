import SwiftUI
import WidgetKit

/// "Próxima aula" na tela de início, como o `NextClassWidget.kt` do Android:
/// a próxima aula da grade salva (`WidgetStore`), com o horário e a sala, como
/// o card do Início. O toque abre o app no Início.
///
/// A linha do tempo já traz um desenho para cada virada (a aula começa ou
/// termina, a meia-noite muda o rótulo do dia, a grade vence), sem acordar o
/// app; o app pede um redesenho quando manda uma grade nova.
@main
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

enum NextClassState {
  /// Sem aula para mostrar: um título e o motivo.
  case message(title: String, text: String)
  case next(NextClass)
}

struct NextClassEntry: TimelineEntry {
  let date: Date
  let state: NextClassState

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
    completion(entry(at: Date(), schedule: WidgetStore.load(), signedOut: WidgetStore.signedOut))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NextClassEntry>) -> Void) {
    let now = Date()
    let schedule = WidgetStore.load()
    let signedOut = WidgetStore.signedOut
    let moments = changes(after: now, schedule: schedule)
    let entries = ([now] + moments).map { entry(at: $0, schedule: schedule, signedOut: signedOut) }
    // sem grade, nada muda até o app mandar uma (ele pede o redesenho)
    completion(Timeline(entries: entries, policy: moments.isEmpty ? .never : .atEnd))
  }

  private func entry(at date: Date, schedule: WidgetSchedule?, signedOut: Bool) -> NextClassEntry {
    guard let schedule = schedule else {
      // logout, ou nada recebido ainda: widget posto antes de o app abrir, ou
      // conta com a grade não lida
      return NextClassEntry(
        date: date,
        state: .message(
          title: "Próxima aula",
          text: signedOut ? "Entre no AO UERJ para ver suas aulas." : "Abra o AO UERJ para carregar a grade."
        )
      )
    }
    if date > schedule.expiresAt {
      return NextClassEntry(
        date: date, state: .message(title: "Próxima aula", text: "Abra o AO UERJ para atualizar a grade."))
    }
    guard let next = WidgetStore.next(schedule, at: date) else {
      return NextClassEntry(
        date: date,
        state: .message(title: "Sem aulas na grade", text: "Nenhuma disciplina em curso com horário."))
    }
    return NextClassEntry(date: date, state: .next(next))
  }

  /**
   * Os momentos em que o widget muda nas próximas 48 horas: cada aula começa
   * ("Agora") ou termina, a meia-noite (o rótulo do dia) e o vencimento da
   * grade. No fim deles, o WidgetKit pede outra linha do tempo.
   */
  private func changes(after now: Date, schedule: WidgetSchedule?) -> [Date] {
    guard let schedule = schedule, now <= schedule.expiresAt else { return [] }
    let calendar = Calendar.current
    let today = calendar.startOfDay(for: now)
    let horizon = now.addingTimeInterval(48 * 60 * 60)
    var moments: [Date] = [schedule.expiresAt.addingTimeInterval(1)]
    for offset in 0...2 {
      guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
      if offset > 0 { moments.append(day) }
      let weekday = WidgetStore.weekdayOf(day, calendar: calendar)
      for item in schedule.classes where item.weekday == weekday {
        moments.append(day.addingTimeInterval(TimeInterval(item.start * 60)))
        moments.append(day.addingTimeInterval(TimeInterval(item.end * 60)))
      }
    }
    return Array(Set(moments.filter { $0 > now && $0 <= horizon })).sorted()
  }
}

// MARK: - Cores (as do widget do Android, claro e escuro)

private struct Palette {
  let surface: Color
  let ink: Color
  let muted: Color
  let accent: Color
  let tileStrong: Color
  let onTileStrong: Color
  let onTileStrongMuted: Color
  let tileSoft: Color

  static let light = Palette(
    surface: Color(hex: 0xFFFFFF),
    ink: Color(hex: 0x101828),
    muted: Color(hex: 0x5D6679),
    accent: Color(hex: 0x004891),
    tileStrong: Color(hex: 0x004891),
    onTileStrong: Color(hex: 0xFFFFFF),
    onTileStrongMuted: Color(hex: 0xCFDDEE),
    tileSoft: Color(hex: 0xE8F0FA)
  )

  static let dark = Palette(
    surface: Color(hex: 0x111F33),
    ink: Color(hex: 0xE6EDF6),
    muted: Color(hex: 0xA7B4C6),
    accent: Color(hex: 0x6DAEF0),
    tileStrong: Color(hex: 0x2A6BC0),
    onTileStrong: Color(hex: 0xFFFFFF),
    onTileStrongMuted: Color(hex: 0xFFFFFF),
    tileSoft: Color(hex: 0x123458)
  )
}

extension Color {
  fileprivate init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

// MARK: - Desenho

private let weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
private let weekdaysShort = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

/// "Agora", "Hoje" ou o dia da semana (inteiro, ou o "Seg" do bloco).
private func dayLabel(_ next: NextClass, short: Bool) -> String {
  if next.ongoing { return "Agora" }
  if next.dayOffset == 0 { return "Hoje" }
  return (short ? weekdaysShort : weekdays)[next.item.weekday - 1]
}

/// "até 18:50 · T6–N1 · Sala 6019 B", ou só "até 18:50".
private func detailText(_ item: WidgetClass) -> String {
  item.detail.isEmpty ? "até \(item.endLabel)" : "até \(item.endLabel) · \(item.detail)"
}

/// Leitor de tela: "Próxima aula, Hoje: Cálculo II, das 14:20 às 16:00, T3–T4 · Sala 6019 B."
private func classDescription(_ next: NextClass) -> String {
  let item = next.item
  let place = [item.detail, item.place].filter { !$0.isEmpty }.joined(separator: ", ")
  let base = "Próxima aula, \(dayLabel(next, short: false)): \(item.title), das \(item.startLabel) às \(item.endLabel)"
  return place.isEmpty ? "\(base)." : "\(base), \(place)."
}

struct NextClassView: View {
  let entry: NextClassEntry

  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.widgetFamily) private var family

  private var palette: Palette { colorScheme == .dark ? .dark : .light }

  var body: some View {
    content
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(spokenText)
      .widgetURL(URL(string: "aouerj://open?target=home"))
      .widgetBackground(palette.surface)
  }

  private var spokenText: String {
    switch entry.state {
    case let .message(title, text): return "\(title). \(text)"
    case let .next(next): return classDescription(next)
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
      Text(dayLabel(next, short: true).uppercased())
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
        Text(detailText(next.item))
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
        Text("\(dayLabel(next, short: false).uppercased()) · \(next.item.startLabel)")
          .font(.caption2.weight(.semibold))
          .lineLimit(1)
        Text(next.item.title).font(.headline).lineLimit(1)
        Text(detailText(next.item)).font(.caption).lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Compatibilidade com iOS 15 a 17

extension View {
  /// O iOS 17 desenha o fundo do widget pelo `containerBackground`; antes, é um fundo comum.
  @ViewBuilder fileprivate func widgetBackground(_ color: Color) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { color }
    } else {
      background(color)
    }
  }
}

extension WidgetConfiguration {
  /// As margens do iOS 17 ficam por conta do `padding` de cada tamanho.
  fileprivate func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
    if #available(iOSApplicationExtension 17.0, *) {
      return contentMarginsDisabled()
    } else {
      return self
    }
  }
}
