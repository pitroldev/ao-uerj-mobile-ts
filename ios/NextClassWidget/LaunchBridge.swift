/// Na extensão do widget, o `OpenAppAreaIntent` só declara a ação do controle:
/// o sistema abre o app e roda o `perform` lá, onde a `LaunchBridge` de
/// `LaunchCenter.swift` leva o destino. Aqui não há o que fazer.
enum LaunchBridge {
  static func open(_ target: String) {}
}
