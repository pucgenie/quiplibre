
if (!navigator.languages) {
	console.log("navigator.languages was not available")
	navigator.languages = [navigator.language || navigator.userLanguage]
	navigator.languages.push(navigator.languages[0].substring(0, 2))
}

function lazyLoad(url, verarbeit) {
	var xhr = new XMLHttpRequest()
	xhr.open('GET', url)
	xhr.onload = function(progressEvent) {
		if (this.status === 200) {
			verarbeit(this.responseText)
		} else {
			console.debug('Loading [' + url + '], returned status of ' + this.status)
		}
	}
	xhr.send()
}

function appendFormattedText(txtTmpl, basis, funcOut){
	var ret
	if (!funcOut) {
		ret = []
		funcOut = xWert => ret.push(xWert)
	}
	for(var txtTeil of txtTmpl){
		if(!txtTeil) {
			console.log("Skipping useless (null or undefined) part of " + txtImpl)
	continue
		}
		if(txtTeil.startsWith('${')){
			// may not contain "(),;"
			//if(!txtTeil.endsWith("}")) throw "defective/malicious template detected"
			funcOut(eval("basis." + txtTeil.substring(2, txtTeil.length - 1)))
	continue
		}
		funcOut(txtTeil)
	}
	return ret
}

/*
 * Handles special translation message parts like "newlines as <br>".
 */
function textToNode(input) {
	if(input==='\n') {
		return document.createElement('br')
	return
	}
	return document.createTextNode(input)
}

function clearElementChilds(xElem){
	while(xElem.firstChild){
		xElem.removeChild(xElem.firstChild)
	}
}

/**
 * Clears xDiv and calls func(xDiv), which should add elements to xDiv ("display something").
**/
function replaceContent(xDiv, func){
	// pucgenie: simply use style.display instead of style.visibility="hidden"|"visible" .
	xDiv.style.display = 'none'
	clearElementChilds(xDiv)
	func(xDiv)
	xDiv.style.display = 'block'
}

class Uebersetz {
	constructor(filename, callback) {
		this.ui_messages = undefined
		this.languages = undefined
		lazyLoad(filename, rText => {
			this.ui_messages = JSON.parse(rText)
			this.languages = this.filterAvailableLanguages(navigator.languages)
			callback(this)
		})
	}
	filterAvailableLanguages(inputArr) {
		var targetSet = new Set()
		for (var setULang of inputArr) {
			if (this.ui_messages.hasOwnProperty(setULang)) {
				targetSet.add(setULang)
		break
			}
		}
		if (targetSet.size <= 1) {
			// pucgenie: we want to know at least one alternative language
			for (var setULang of inputArr) {
				setULang = setULang.substring(0, 2)
				if (this.ui_messages.hasOwnProperty(setULang)) {
					targetSet.add(setULang)
			break
				}
			}
		}
		// pucgenie: Remember: the default language has to contain all keys
		targetSet.add("en")
		return targetSet
	}
	/**
	 * Full-blown translate-and-format function.
	 * Quite some overhead and complex return control flow.
	 * @author pucgenie@hotmail.com
	**/
	__(langs, key, basis, funcOut) {
		//console.log({"lookup": key, "langs": langs})
		var ret
		var usedLang
		for (var altLang of langs) {
			usedLang = altLang
			ret = this.ui_messages[altLang][key]
			if (ret) {
		break
			}
		}
		if (!ret) {
	throw {"unresolvableTranslationKey": key}
		}
		if (Array.isArray(ret)) {
			if (ret.length > 1) {
				ret = appendFormattedText(ret, basis, funcOut)
			} else {
				funcOut(ret[0])
			}
		} else {
			funcOut(ret)
		}
	return usedLang
	}
}

/*
 * Should enhance readability a litte bit.
 * Assumes that there exists a customized __ function for translation.
 */
function replaceContentTranslated(xDiv, transKey, params) {
	replaceContent(xDiv, xDiv => __(transKey, params, satz => xDiv.appendChild(textToNode(satz))))
	return xDiv
}
