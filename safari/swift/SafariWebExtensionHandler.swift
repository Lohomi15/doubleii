import SafariServices
import os.log

// doubleii uses chrome.runtime.sendMessage for all content ↔ service-worker
// communication — no native messaging is required. This handler is the required
// NSExtensionRequestHandling stub; it receives nothing at runtime.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems[0] as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey]
        os_log(.default, "[doubleii] native message received: %@", message as! CVarArg)

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: [:]]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
