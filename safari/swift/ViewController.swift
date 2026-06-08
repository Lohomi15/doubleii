import Cocoa
import SafariServices

let extensionBundleIdentifier = "io.doubleii.extension.Extension"

class ViewController: NSViewController {
    @IBOutlet var appNameLabel: NSTextField!
    @IBOutlet var openPreferencesButton: NSButton!

    override func viewDidLoad() {
        super.viewDidLoad()
        appNameLabel?.stringValue = "doubleii"
    }

    @IBAction func openSafariExtensionPreferences(_ sender: AnyObject?) {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            DispatchQueue.main.async {
                if let error = error {
                    NSApp.presentError(error)
                }
            }
        }
    }
}
