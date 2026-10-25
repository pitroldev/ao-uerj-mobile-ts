import Foundation
import UserNotifications

/// Aberturas do app vindas de fora (aviso tocado, atalho do ícone, toque no
/// widget), como o `AppLaunch.kt` do Android: guarda o destino até o JS lê-lo
/// uma vez (`consumeLaunchTarget`) e, com o app em memória, avisa o módulo
/// dos avisos para emitir `onOpenTarget`.
///
/// É também o delegate dos avisos: precisa ser definido no `AppDelegate`,
/// antes de o app terminar de abrir, para receber o toque que abriu o app.
@objc(AOLaunchCenter)
public final class LaunchCenter: NSObject, UNUserNotificationCenterDelegate {
  @objc public static let shared = LaunchCenter()

  private let lock = NSLock()
  private var pending: String?

  /// Chamado (na thread principal) quando chega um destino novo; o módulo
  /// dos avisos o define ao ser criado pelo React Native.
  @objc public var onTarget: (() -> Void)?

  @objc public func open(_ target: String) {
    lock.lock()
    pending = target
    lock.unlock()
    DispatchQueue.main.async { self.onTarget?() }
  }

  /// O destino guardado, lido uma vez.
  @objc public func consume() -> String? {
    lock.lock()
    defer {
      pending = nil
      lock.unlock()
    }
    return pending
  }

  // Aviso tocado (com o app aberto, em segundo plano ou fechado).
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    if let target = response.notification.request.content.userInfo["target"] as? String {
      open(target)
    }
    completionHandler()
  }

  // Com o app na frente, o aviso aparece mesmo assim, como no Android.
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound])
  }
}

/// O destino dos App Intents de abrir (`OpenAppIntent.swift`). A extensão do
/// widget tem a sua versão, vazia: lá o intent só declara a ação.
enum LaunchBridge {
  static func open(_ target: String) {
    LaunchCenter.shared.open(target)
  }
}
