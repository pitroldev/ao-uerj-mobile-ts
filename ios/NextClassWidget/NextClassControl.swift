import AppIntents
import SwiftUI
import WidgetKit

/// "Próxima aula" na Central de Controle e na tela bloqueada (iOS 18): abre o
/// app no Início, onde está a próxima aula.
@available(iOSApplicationExtension 18.0, *)
struct NextClassControl: ControlWidget {
  static let kind = "NextClassControl"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenAppAreaIntent(target: .home)) {
        Label("Próxima aula", systemImage: "calendar.badge.clock")
      }
    }
    .displayName("Próxima aula")
    .description("Abre o AO UERJ no Início, com a próxima aula.")
  }
}
