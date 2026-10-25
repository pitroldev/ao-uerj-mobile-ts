import UIKit
import UserNotifications

/// A abertura do processo. A janela e o React Native ficam na `SceneDelegate`
/// (Info.plist, UIApplicationSceneManifest), como no template do React
/// Native 0.88.
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Remove cached legacy AO login URLs before a React networking session starts.
    // Credentials and account preferences live in separate, untouched stores.
    URLCache.shared.removeAllCachedResponses()

    // antes de terminar a abertura, para receber o toque no aviso que abriu o app
    UNUserNotificationCenter.current().delegate = LaunchCenter.shared

    return true
  }
}
