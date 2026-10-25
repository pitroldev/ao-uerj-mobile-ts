import AppIntents
import Foundation

/// As telas que um atalho do sistema abre: as mesmas dos atalhos do ícone.
@available(iOS 16.0, *)
enum AppArea: String, AppEnum {
  case home
  case grades
  case map
  case documents

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Tela do AO UERJ"
  static let caseDisplayRepresentations: [AppArea: DisplayRepresentation] = [
    .home: "Início",
    .grades: "Notas",
    .map: "Mapa",
    .documents: "Documentos",
  ]
}

/// Abre o app numa tela, pela Siri, pelo app Atalhos, pelo Spotlight ou pelo
/// controle da Central de Controle. Este arquivo entra no app e na extensão do
/// widget: o controle declara a ação, e o sistema abre o app para o `perform`,
/// que leva o destino à `LaunchCenter` (`LaunchBridge`).
@available(iOS 16.0, *)
struct OpenAppAreaIntent: OpenIntent {
  static let title: LocalizedStringResource = "Abrir no AO UERJ"
  static let description = IntentDescription(
    "Abre o AO UERJ no Início, nas notas, no mapa ou nos documentos.")

  @Parameter(title: "Tela", default: .home)
  var target: AppArea

  init() {}

  init(target: AppArea) {
    self.target = target
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    LaunchBridge.open(target.rawValue)
    return .result()
  }
}
