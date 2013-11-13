window.addEventListener("load", function(e) {
    External.startup();
}, false);

var External = {
    prefs: null,
    startup: function () {
        Components.utils.import("resource://gre/modules/FileUtils.jsm");
        Components.utils.import("resource://gre/modules/NetUtil.jsm");
        Components.utils.import("resource:///modules/gloda/utils.js");
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.open-with.command.");
        this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        this.prefs.addObserver("", this, false);
        this.refreshMenu();
    },

    observe: function(subject, topic, data) {
        this.refreshMenu();
    },

    refreshMenu: function() {
        var popup = document.getElementById("owMenuPopup");

        while(popup.hasChildNodes()){
            popup.removeChild(popup.firstChild);
        }

        for (i = 1; i <= 5; i++) {
            name = this.prefs.getCharPref("name" + i);
            action = this.prefs.getCharPref("action" + i);
            if (name == "" || action == "") {
                continue;
            }
            popup.appendChild(this.createMenuItem(name, i));
        }
    },

    createMenuItem: function (name, action) {
        const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        var item = document.createElementNS(XUL_NS, "menuitem"); // create a new XUL menuitem
        item.setAttribute("label", name);
        item.setAttribute("oncommand", "External.onCommand(" + action + ")");
        return item;
    },

    getMessageBody: function (aMessageHeader) {
        let messenger = Components.classes["@mozilla.org/messenger;1"]
            .createInstance(Components.interfaces.nsIMessenger);
        let listener = Components.classes["@mozilla.org/network/sync-stream-listener;1"]
            .createInstance(Components.interfaces.nsISyncStreamListener);
        let uri = aMessageHeader.folder.getUriForMsg(aMessageHeader);
        messenger.messageServiceFromURI(uri)
            .streamMessage(uri, listener, null, null, false, "");
        let folder = aMessageHeader.folder;
        return folder.getMsgTextFromStream(listener.inputStream,
                aMessageHeader.Charset, -1, -1, false, true, { });
    },

    messageToText: function (msg) {
        a = "";
        a += "Subject: " + GlodaUtils.deMime(msg.subject)    + "\n";
        a += "From: "    + GlodaUtils.deMime(msg.author)     + "\n";
        if (msg.recipients) {
            a += "To: "      + GlodaUtils.deMime(msg.recipients) + "\n";
        }
        if (msg.cclist) {
            a += "Cc: "      + GlodaUtils.deMime(msg.cclist)   + "\n";
        }

        a += "\n";

        a += this.getMessageBody(msg);
        a = String.replace(a, /\r/g, "");
        return a;
    },

    messagesToText: function (msgs) {
        a = "";
        for (i = 0; i < msgs.length; i++) {
            msg = msgs[i];
            if (msgs.length > 1) {
                a += "X-In-Series: " + (i + 1) + "/" + msgs.length + "\n";
            }
            a += this.messageToText(msg) + "\n\n";
        }
        return a;
    },

    saveMessages: function(complete_cb) {
        var file = FileUtils.getFile("TmpD", ["ow-message.eml"]);
        file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
        // do whatever you need to the created file

        var ostream = FileUtils.openSafeFileOutputStream(file);
        var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
            createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        converter.charset = "UTF-8";
        var istream = converter.convertToInputStream(this.messagesToText(gFolderDisplay.selectedMessages));
        NetUtil.asyncCopy(istream, ostream, function(status) {
            complete_cb(file.path, status);
        });
    },

    onCommand: function (idx) {
        action = this.prefs.getCharPref("action" + idx);
        this.saveMessages( function (path, status) {
            action = String.replace(action, "%", path);
            runCommand(action);
        });
    },
};

function splitCommand(cmd) {
    a = cmd.split(" ");
    ret = [];
    inquote = 0;
    p = 0;
    for (i = 0; i < a.length; i++) {
        cur = a[i];
        if (inquote) {
            ret[p] += " " + cur;
            if (cur.lastIndexOf('"') == cur.length - 1) {
                inquote = 0;
                ret[p] = ret[p].slice(1, -1);
            }
        } else if (cur[0] == '"') {
            inquote = 1;
            ret.push(cur);
            p = ret.length - 1;
        } else {
            ret.push(cur);
        }
    }
    return ret;
}

function runCommand(cmd) {
    a = splitCommand(cmd);
    exePath = a[0];
    args = a.slice(1);
    // 创建一个表示可执行文件的nsILocalFile实例
    var file = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(exePath);

    // 创建一个nsIProcess实例
    var process = Components.classes["@mozilla.org/process/util;1"]
        .createInstance(Components.interfaces.nsIProcess);
    process.init(file);

    // 运行进程.
    // 如果第一个参数为true,则run方法会在一直阻塞直到进程结束.
    // 第二个和第三个参数用来给运行程序传递命令行参数.
    process.run(false, args, args.length);
}

