if (!navigator.languages) {
	navigator.languages = [navigator.language || navigator.userLanguage]
	navigator.languages.push(navigator.languages[0].substring(0, 2))
}

function filterAvailableLanguages(inputArr, targetSet) {
	var targetSet = new Set()
	for (var setULang of inputArr) {
		if (ui_messages.hasOwnProperty(setULang)) {
			targetSet.add(setULang)
	break
		}
	}
	for (var setULang of inputArr) {
		setULang = setULang.substring(0, 2)
		if (ui_messages.hasOwnProperty(setULang)) {
			targetSet.add(setULang)
	break
		}
	}
	// pucgenie: the default language has to contain all keys
	targetSet.add("en")
	return targetSet
}

const hostLanguages = filterAvailableLanguages(navigator.languages)

/**
 * Full-blown translate-and-format function.
 * Quite some overhead...
 * @author pucgenie@hotmail.com
**/
function __(langs, key, basis, funcOut) {
	//console.log({"lookup": key, "langs": langs})
	var ret
	for (var altLang of langs) {
		ret = ui_messages[altLang][key]
		if (ret) {
	break
		}
	}
	if (!ret) {
		console.log({"unresolvable": key})
	}
	if (ret.length > 1) {
		ret = appendFormattedText(ret, basis, funcOut)
	} else if (funcOut) {
		funcOut(ret[0])
	} else {
		return ret[0]
	}
	if (!funcOut) {
		return ret.join('')
	}
}

function lazyLoad(url, verarbeit) {
	var xhr = new XMLHttpRequest()
	xhr.open('GET', url)
	xhr.onload = function(progressEvent) {
		if (this.status === 200) {
			verarbeit(JSON.parse(this.responseText))
		} else {
			console.log('Failed to load Quiplash data.  Returned status of ' + this.status)
		}
	}
	xhr.send()
}

function randInt(min, max) {
	if (max === undefined) {
		max = min
		min = 0
	}
	return Math.random() * (max - min) + min | 0
}

function appendFormattedText(txtTmpl, basis, funcOut){
	var ret
	if (!funcOut) {
		ret = []
		funcOut = xWert => ret.push(xWert)
	}
	for(var txtTeil of txtTmpl){
		if(txtTeil.startsWith("${")){
			// may not contain "(),;"
			//if(!txtTeil.endsWith("}")) throw "defective/malicious template detected"
			funcOut(eval("basis." + txtTeil.substring(2, txtTeil.length - 1)))
	continue
		}
		funcOut(txtTeil)
	}
	return ret
}

function clearElementChilds(xElem){
	while(xElem.firstChild){
		xElem.removeChild(xElem.firstChild)
	}
}
