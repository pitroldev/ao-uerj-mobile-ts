import SwiftUI
import WidgetKit

/// Os widgets e o controle da extensão: "Próxima aula", "Hoje" e, no iOS 18, o
/// controle da Central de Controle.
@main
struct AOUerjWidgets: WidgetBundle {
  var body: some Widget {
    NextClassWidget()
    TodayWidget()
    if #available(iOSApplicationExtension 18.0, *) {
      NextClassControl()
    }
  }
}
