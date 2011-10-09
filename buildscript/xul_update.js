// *****************************************************************
// * XUL�A�v���̍X�V�󋵂�RSS��
// *****************************************************************
//
// �K�v�ȕ��F
//    _APPNAME.html    : ���{��ł̔z�z�y�[�W��HTML
//    _APPNAME.html.en : �p��ł̔z�z�y�[�W��HTML
//    xul.xml          : ���{��ł̍X�V���RSS
//    xul.xml.en       : �p��ł̍X�V���RSS
//
// _APPNAME.html �܂��� _APPNAME.html.en ���J������Ԃł��̃X�N���v�g�����s����ƁA
// xul.xml �� xul.xml.en ���X�V����Axul.xml.en �� update.rdf �Ƃ��ĕ��������B

var defaultHTMLDir = 'C:\\Users\\Public\\website\\or\\xul\\';
var defaultRSSDir  = 'C:\\Users\\Public\\website\\or\\xul\\';
var defaultXPIDir  = 'C:\\Users\\Public\\data\\codes\\%appname%\\';
var defaultHashDir = 'C:\\Users\\Public\\data\\codes\\%appname%\\';

var defaultHTMLEncoding = 'Shift_JIS';

var htmlJaSuffix = '.html';
var htmlEnSuffix = '.html.en';
var xpiJaSuffix  = '.xpi';
var xpiEnSuffix  = '_en.xpi';
var rssJaFile    = 'xul.xml';
var rssEnFile    = 'xul.xml.en';

var hashFile  = 'sha1hash.txt';
var updateRes = 'update.rdf';

var updateInfoPostPassword = '';
var updateInfoPostURI = 'http://piro.sakura.ne.jp/wiki/wiki.cgi/extensions/%appname%/%lang%/%version%.wikieditish';
var getNameFunc = function(aService, aDocument) { // must return a string
		return aService.evaluateXPath(
				'//html:h1',
				aDocument,
				XPathResult.STRING_TYPE
			).stringValue.replace(/\s+/g, ' ');
	};
var getVersionFunc = function(aService, aDocument) { // must return a string
		return aService.evaluateXPath(
				'//*[@id="history"]/descendant::html:dt[1]',
				aDocument,
				XPathResult.STRING_TYPE
			).stringValue.replace(/^\s*|(\s*\([^\)]*\))\s*$/g, '');
	};
var getUpdatesFunc = function(aService, aDocument) { // must return object which has two arrays
		var nodes = aService.evaluateXPath(
				'//*[@id="history"]/descendant::html:dt[1]/following::html:ul[1]/html:li',
				aDocument,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
			);
		var range = aDocument.createRange();
		var result = {
				nodes : [],
				strings : []
			};
		for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
		{
			range.selectNodeContents(nodes.snapshotItem(i));
			result.nodes.push(range.cloneContents(true));
			let children = result.nodes[result.nodes.length-1].childNodes;
			for (let i = children.length-1; i > -1; i--)
			{
				let child = children[i];
				if (child.nodeType != Node.ELEMENT_NODE ||
					child.localName.toLowerCase() != 'a' ||
					!child.hasAttribute('href'))
					continue;
				child.textContent += ' ( '+child.getAttribute('href')+' ) ';
			}
			range.selectNodeContents(result.nodes[result.nodes.length-1]);
			result.strings.push(range.toString());
		}
		range.detach();
		return result;
	};


// =============================================================================

var DEBUG = false;

var IOService = Components
			.classes['@mozilla.org/network/io-service;1']
			.getService(Components.interfaces.nsIIOService);

var UCONV = Components
			.classes['@mozilla.org/intl/scriptableunicodeconverter']
			.getService(Components.interfaces.nsIScriptableUnicodeConverter);

function HTMLToRSSConverter(aHTMLFile, aRSSFile, aLang, aHashFile, aAnotherOutput)
{
	this.html    = aHTMLFile;
	this.rss     = aRSSFile;
	this.lang    = aLang;
	this.hash    = aHashFile;
	this.another = aAnotherOutput;
	this.init();
}
HTMLToRSSConverter.prototype = {
	init : function()
	{
		var date = new Date();
		this.date = [
				date.getFullYear(),
				'-',
				String(date.getMonth()+1).replace(/^(.)$/, '0$1'),
				'-',
				String(date.getDate()).replace(/^(.)$/, '0$1'),
				'T',
				String(date.getHours()).replace(/^(.)$/, '0$1'),
				':',
				String(date.getMinutes()).replace(/^(.)$/, '0$1'),
				':',
				String(date.getSeconds()).replace(/^(.)$/, '0$1'),
				'+09:00'
			].join('');

		/(_([^\.\/\\]+)\.[\w\.]+\w)$/i.test(this.html);
		this.fileName = RegExp.$1;
		this.appName = RegExp.$2;
		if (/(index|history)(\.[\w\.]+\w)$/.test(this.html)) {
			/([^\/\\]+)[\/\\](index|history)(\.[\w\.]+\w)$/i.test(this.html);
			this.appName = RegExp.$1;
			this.fileName = this.appName+'/index'+RegExp.$3;
		}

		if (
			!this.loadHash() ||
			!this.loadHTML() ||
			!this.getUpdateInfo()
			)
			return;

		if (this.rss) {
			if (
				!this.loadRSS() ||
				!this.updateRSS() ||
				(!DEBUG && !this.saveRSS())
				) {
				// do nothing
			}
		}
		if (!DEBUG) this.postUpdateInfo();
	},

	loadHash : function()
	{
		this.hash = this.readFrom(this.hash);
		return this.hash ? true : false ;
	},

	loadHTML : function()
	{
		UCONV.charset = defaultHTMLEncoding;
		var source = this.readFrom(this.html);
		if (!source) return false;

		source = UCONV.ConvertToUnicode(source);
		if (source.indexOf('<!DOCTYPE') != 0)
			source = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n'+source;
		var parser = new DOMParser();
		this.htmlDoc = parser.parseFromString(source, 'text/xml');

		if (!this.htmlDoc.documentElement) {
			alert(this.html+'\n\u4e0d\u6b63\u306aHTML\u3067\u3059');
			return false;
		}
		else if (this.htmlDoc.documentElement.localName == 'parsererror') {
			alert(this.html+'\n\n'+this.htmlDoc.documentElement.textContent);
			return false;
		}

		this.historyDoc = null;
		if (!/index(\.[\w\.]+\w)$/.test(this.html)) return true;

		var history = this.html.replace(/index(\.[\w\.]+\w)$/, 'history$1');

		UCONV.charset = defaultHTMLEncoding;
		var source = this.readFrom(history);
		if (!source) return false;

		source = UCONV.ConvertToUnicode(source);
		if (source.indexOf('<!DOCTYPE') != 0)
			source = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n'+source;
		var parser = new DOMParser();
		this.historyDoc = parser.parseFromString(source, 'text/xml');

		if (!this.historyDoc.documentElement) {
			alert(history+'\n\u4e0d\u6b63\u306aHTML\u3067\u3059');
			return false;
		}
		else if (this.historyDoc.documentElement.localName == 'parsererror') {
			alert(history+'\n\n'+this.historyDoc.documentElement.textContent);
			return false;
		}
		return true;
	},

	getUpdateInfo : function()
	{
		if (!this.htmlDoc && !this.historyDoc) return false;

		this.title = getNameFunc(this, this.htmlDoc);
		this.version = getVersionFunc(this, this.historyDoc || this.htmlDoc);

		var result = getUpdatesFunc(this, this.historyDoc || this.htmlDoc);
		this.updates = result.nodes;
		this.updatesString = result.strings;

		return true;
	},

	loadRSS : function()
	{
		var source = this.readFrom(this.rss);
		if (!source) return false;

		var found = /^<\?xml\s.*encoding=['"]([^'"]+)['"]/.test(source);
		var encoding = found ? RegExp.$1 : 'UTF-8';
		UCONV.charset = encoding;
		source = UCONV.ConvertToUnicode(source);
		var parser = new DOMParser();
		this.rssDoc = parser.parseFromString(source, 'text/xml');

		if (!this.rssDoc.documentElement) {
			alert(this.rss+'\n\u4e0d\u6b63\u306aRSS\u3067\u3059');
			return false;
		}
		else if (this.rssDoc.documentElement.localName == 'parsererror') {
			alert(this.rss+'\n\n'+this.rssDoc.documentElement.textContent);
			return false;
		}
		return true;
	},

	updateRSS : function()
	{
		return (
			this.rssDoc &&
			this.updateDate() &&
			this.updateItem() &&
			this.updateList()
			);
	},

	updateDate : function()
	{
		if (!this.rssDoc) return false;
		var dateNode = this.evaluateXPath(
				'//dc:date',
				this.rssDoc,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		dateNode.textContent = this.date;
		return true;
	},

	updateItem : function()
	{
		if (!this.rssDoc) return false;
		var item = this.evaluateXPath(
				'//rss:item[contains(attribute::rdf:about, "'+this.fileName+'")]',
				this.rssDoc,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;

		var title = this.evaluateXPath(
				'rss:title',
				item,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		title.textContent = this.title;

		var desc = this.evaluateXPath(
				'rss:description',
				item,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		var updates = this.updatesString.join(', ');
		if (updates.length > 100)
			updates = updates.substring(0, 100)+'...';
		desc.textContent = updates;

		var date = this.evaluateXPath(
				'dc:date',
				item,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		date.textContent = this.date;

		var version = this.evaluateXPath(
				'descendant::em:version',
				item,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		version.textContent = this.version;

		var nodes = this.evaluateXPath(
				'parent::*/descendant::rdf:Description',
				version,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
			);
		for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
		{
			var fileName = this.evaluateXPath(
					'em:updateLink',
					nodes.snapshotItem(i),
					XPathResult.STRING_TYPE
				).stringValue.match(/[^\/]+\.xpi/);
			(new RegExp('^([0-9a-f]+)\\s+\\*'+fileName+'$', 'mi')).test(this.hash);
			var hash = this.evaluateXPath(
					'em:updateHash',
					nodes.snapshotItem(i),
					XPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue;
			hash.textContent = 'sha1:'+RegExp.$1;
			var link = this.evaluateXPath(
					'em:updateLink',
					nodes.snapshotItem(i),
					XPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue;
			link.textContent = link.textContent
								.replace(/\?update(\&version=.*)?$/, '') + '?update&version=' + this.version;
		}

		return true;
	},

	updateList : function()
	{
		if (!this.rssDoc) return false;
		var item = this.evaluateXPath(
				'//rss:item[contains(attribute::rdf:about, "'+this.fileName+'")]',
				this.rssDoc,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;

		var range = this.rssDoc.createRange();
		range.selectNode(item);
		range.setStartBefore(item.previousSibling);
		item = range.extractContents(true);

		var channel = this.evaluateXPath(
				'//rss:channel',
				this.rssDoc,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		range.selectNode(channel);
		range.setStartAfter(channel);
		range.insertNode(item);

		var li = this.evaluateXPath(
				'//rdf:li[contains(attribute::rdf:resource, "'+this.fileName+'")]',
				this.rssDoc,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;

		var container = li.parentNode;

		range.selectNode(li);
		range.setStartBefore(li.previousSibling);
		li = range.extractContents(true);

		container.insertBefore(li, container.firstChild);

		range.detach();

		return true;
	},

	saveRSS : function()
	{
		var persist = Components
				.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
				.createInstance(Components.interfaces.nsIWebBrowserPersist);

		persist.persistFlags = persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
				persist.PERSIST_FLAGS_BYPASS_CACHE;

		var url = this.rss;
		var file;
		if (url.indexOf('file://') == 0) {
			file = IOService.getProtocolHandler('file')
					.QueryInterface(Components.interfaces.nsIFileProtocolHandler)
					.getFileFromURLSpec(url);
		}
		else {
			var file = Components
					.classes['@mozilla.org/file/local;1']
					.createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(url);
		}
		if (!file.exists()) return false;

		this.saveRSSAs(file);

		if (this.another) {
			var another = file.parent;
			another.append(this.another);
			this.saveRSSAs(another);
		}
		return true;
	},

	saveRSSAs : function(aFile)
	{
		var persist = Components
				.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1']
				.createInstance(Components.interfaces.nsIWebBrowserPersist);

		persist.persistFlags = persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
				persist.PERSIST_FLAGS_BYPASS_CACHE;

		persist.saveDocument(
			this.rssDoc,
			IOService.newFileURI(aFile),
			null,
			'application/xml',
			persist.ENCODE_FLAGS_ENCODE_BASIC_ENTITIES,
			999999
		);
	},

	postUpdateInfo : function()
	{
		if (!updateInfoPostURI || !updateInfoPostPassword) return;

		var uri = updateInfoPostURI
					.replace(/%appname%/gi, this.appName)
					.replace(/%lang%/gi, this.lang)
					.replace(/%version%/gi, this.version);

		var params = [
				'plugin=wikieditish',
				'title='+encodeURIComponent(this.appName+' '+this.version),
				'body='+encodeURIComponent(
					this.updatesString.map(function(aItem) {
						return ' * '+aItem;
					}).join('\n')
				),
				'creation_date=',
				'password='+encodeURIComponent(updateInfoPostPassword),
				'post='+encodeURIComponent('\u30da\u30fc\u30b8\u3092\u4fdd\u5b58')
			].join('&');

		var request = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1']
					.createInstance(Components.interfaces.nsIXMLHttpRequest);
		request.open('POST', uri, true);
		request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
		request.send(params);
	},

	// utilities

	readFrom : function(aFile)
	{
		if (typeof aFile == 'string') {
			if (aFile.indexOf('file://') == 0) {
				aFile = IOService.getProtocolHandler('file')
							.QueryInterface(Components.interfaces.nsIFileProtocolHandler)
							.getFileFromURLSpec(aFile);
			}
			else {
				var file = Components
						.classes['@mozilla.org/file/local;1']
						.createInstance(Components.interfaces.nsILocalFile);
				file.initWithPath(aFile);
				aFile = file;
			}
		}

		var fileContents;

		var stream = Components
						.classes['@mozilla.org/network/file-input-stream;1']
						.createInstance(Components.interfaces.nsIFileInputStream);
		try {
			stream.init(aFile, 1, 0, false); // open as "read only"

			var scriptableStream = Components
									.classes['@mozilla.org/scriptableinputstream;1']
									.createInstance(Components.interfaces.nsIScriptableInputStream);
			scriptableStream.init(stream);

			var fileSize = scriptableStream.available();
			fileContents = scriptableStream.read(fileSize);

			scriptableStream.close();
			stream.close();
		}
		catch(e) {
			dump(e+'\n');
			return null;
		}

		return fileContents;
	},

	NSResolver : {
		lookupNamespaceURI : function(aPrefix)
		{
			switch (aPrefix)
			{
				case 'xul':
					return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
				case 'html':
				case 'xhtml':
					return 'http://www.w3.org/1999/xhtml';
				case 'xlink':
					return 'http://www.w3.org/1999/xlink';
				case 'rdf':
					return 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
				case 'rss':
					return 'http://purl.org/rss/1.0/';
				case 'dc':
					return 'http://purl.org/dc/elements/1.1/';
				case 'em':
					return 'http://www.mozilla.org/2004/em-rdf#';
				default:
					return '';
			}
		}
	},

	evaluateXPath : function(aExpression, aContext, aType)
	{
		if (!aType) aType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
		try {
			var xpathResult = (aContext.ownerDocument || aContext).evaluate(
					aExpression,
					aContext,
					this.NSResolver,
					aType,
					null
				);
		}
		catch(e) {
			return {
				singleNodeValue : null,
				snapshotLength  : 0,
				snapshotItem    : function() {
					return null
				}
			};
		}
		return xpathResult;
	}

}


// select HTML

var filePicker = Components
		.classes['@mozilla.org/filepicker;1']
		.createInstance(Components.interfaces.nsIFilePicker);

var htmlJa;
var htmlEn;
var rssJa;
var rssEn;

var htmlJaSuffixRE = new RegExp(htmlJaSuffix.replace(/\./g, '\\.')+'$');
var htmlEnSuffixRE = new RegExp(htmlEnSuffix.replace(/\./g, '\\.')+'$');

var uri = gBrowser.currentURI.spec.split('#')[0];
if (gBrowser.currentURI.schemeIs('file')) {
	var path = IOService.getProtocolHandler('file')
					.QueryInterface(Components.interfaces.nsIFileProtocolHandler)
					.getFileFromURLSpec(gBrowser.currentURI.spec).path;
	if (htmlJaSuffixRE.test(path)) {
		htmlJa = path;
		htmlEn = path.replace(htmlJaSuffixRE, htmlEnSuffix);
	}
	else if (htmlEnSuffixRE.test(path)) {
		htmlEn = path;
		htmlJa = path.replace(htmlEnSuffixRE, htmlJaSuffix);
	}
}

if (!htmlJa || !htmlEn) {
	filePicker.init(
		window,
		'\u5909\u63db\u5143\u306eHTML\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044',
		filePicker.modeOpen
	);
	if (filePicker.show() == filePicker.returnCancel) return;

	var path = filePicker.file.path;
	if (htmlJaSuffixRE.test(path)) {
		htmlJa = path;
		htmlEn = path.replace(htmlJaSuffixRE, htmlEnSuffix);
	}
	else if (htmlEnSuffixRE.test(path)) {
		htmlEn = path;
		htmlJa = path.replace(htmlEnSuffixRE, htmlJaSuffix);
	}
	else {
		return;
	}
}

/(_([^\.\/\\]+)\.[\w\.]+\w)$/i.test(htmlJa);
var appName = RegExp.$2;
if (/(index|history)(\.[\w\.]+\w)$/.test(htmlJa)) {
	/([^\/\\]+)[\/\\](index|history)\.[\w\.]+\w$/i.test(htmlJa);
	appName = RegExp.$1;
	htmlJa = htmlJa.replace(/history(\.[\w\.]+\w)$/, 'index$1');
	htmlEn = htmlEn.replace(/history(\.[\w\.]+\w)$/, 'index$1');
}

// select RSS

var tempLocalFile = Components
		.classes['@mozilla.org/file/local;1']
		.createInstance(Components.interfaces.nsILocalFile);

var rssJa = defaultRSSDir + rssJaFile;
tempLocalFile.initWithPath(rssJa);
if (!tempLocalFile.exists()) {
	rssJa = htmlJa.replace(/[^\/\\]+([\/\\]index[^\/]+)?$/, rssJaFile);
	tempLocalFile.initWithPath(rssJa);
	if (!tempLocalFile.exists()) {
		filePicker.init(
			window,
			'\u53cd\u6620\u5148\u306eRSS\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044',
			filePicker.modeSave
		);
		if (filePicker.show() != filePicker.returnCancel) {
			rssJa = filePicker.file.path;
		}
		else {
			rssJa = null;
		}
	}
}
var rssEn = rssJa ? rssJa.replace(/[^\/\\]+$/, rssEnFile) : null ;


// select Hash

var hashPath;
if (rssJa && rssEn) {
	defaultHashDir = defaultHashDir.replace(/%appname%/gi, appName);

	hashPath = defaultHashDir + hashFile;
	tempLocalFile.initWithPath(hashPath);
	if (!tempLocalFile.exists()) {
		hashPath = htmlJa.replace(/[^\/\\]+$/, hashFile);
		tempLocalFile.initWithPath(hashPath);
		if (!tempLocalFile.exists()) {
			hashPath = rssJa.replace(/[^\/\\]+$/, hashFile);
			tempLocalFile.initWithPath(hashPath);
			if (!tempLocalFile.exists()) {
				filePicker.init(
					window,
					'\u30cf\u30c3\u30b7\u30e5\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044',
					filePicker.modeOpen
				);
				if (filePicker.show() == filePicker.returnCancel) return;
				hashPath = filePicker.file.path;
				if (!(new RegExp(hashFile+'$')).test(hashPath)) return;
			}
		}
	}
}


if (!updateInfoPostPassword) updateInfoPostPassword = prompt('\u6295\u7a3f\u7528\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044');

new HTMLToRSSConverter(htmlJa, rssJa, 'ja', hashPath, updateRes);
new HTMLToRSSConverter(htmlEn, rssEn, 'en-US', hashPath, updateRes);
