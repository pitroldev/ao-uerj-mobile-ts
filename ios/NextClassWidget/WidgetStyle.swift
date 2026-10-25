import SwiftUI
import WidgetKit

// MARK: - Cores (as dos widgets do Android, claro e escuro)

struct Palette {
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

  static func of(_ scheme: ColorScheme) -> Palette {
    scheme == .dark ? .dark : .light
  }
}

extension Color {
  init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}

/// O toque abre o app no Início (SceneDelegate → LaunchCenter).
let homeURL = URL(string: "aouerj://open?target=home")

// MARK: - Compatibilidade com iOS 15 a 17

extension View {
  /// O iOS 17 desenha o fundo do widget pelo `containerBackground`; antes, é um fundo comum.
  @ViewBuilder func widgetBackground(_ color: Color) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { color }
    } else {
      background(color)
    }
  }
}

extension WidgetConfiguration {
  /// As margens do iOS 17 ficam por conta do `padding` de cada tamanho.
  func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
    if #available(iOSApplicationExtension 17.0, *) {
      return contentMarginsDisabled()
    } else {
      return self
    }
  }
}
