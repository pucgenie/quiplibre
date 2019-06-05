"use strict";

if (!navigator.languages) {
	console.log("navigator.languages was not available")
	navigator.languages = []
}
if(navigator.languages.length == 0){
	if(navigator.userLanguage){
		navigator.languages.push(navigator.userLanguage)
	}
	if(navigator.language){
		navigator.languages.push(navigator.language)
	}
	//console.log(navigator.languages)
	navigator.languages.push(navigator.languages[0].substring(0, 2))
}

class Uebersetz {
	constructor(filename, callback) {
		this.ui_messages = {}
		lazyLoad('locales.json', locList => {
			const availLocs = JSON.parse(locList)
			let altLangs = navigator.languages
			for(let iXx = 2; iXx --> 0; --iXx){
				this.languages = new Set(availLocs.filter(value => altLangs.includes(value)))
				if(this.languages.size > 0){
			break
				}
				altLangs = navigator.languages.map(x => x.substring(0, 2))
			}
			// pucgenie: last resort fallback
			this.languages.add('en')
			this.languages = Array.from(this.languages)
			let cnt = this.languages.length
			for(let cloc of this.languages){
				lazyLoad(`locales/${filename}_${cloc}.json`, rText => {
					// pucgenie: race condition? Fixed by using 'let'
					//console.log(xCloc)
					this.ui_messages[cloc] = JSON.parse(rText)
					if(--cnt == 0){
						callback(this)
					}
				}, (xhr, progressEvent) => console.log({"xhrPart": cloc, "unexpectedStatus": xhr.status, "progressEvent": progressEvent}))
			}
		}, (xhr, progressEvent) => {
			console.log({"xhrPart": "locales.json", "unexpectedStatus": xhr.status, "progressEvent": progressEvent})
		})
	}
	/**
	 * Full-blown translate-and-format function.
	 * Quite some overhead and complex return control flow.
	 * @author pucgenie@hotmail.com
	**/
	__(langs, key, basis, funcOut) {
		//console.log({"lookup": key, "langs": langs})
		let ret
		let usedLang
		for (let altLang of langs) {
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

/**
 * 
**/
function appendFormattedText(txtTmpl, basis, funcOut){
	let ret
	if (!funcOut) {
		ret = []
		funcOut = xWert => ret.push(xWert)
	}
	for(let txtTeil of txtTmpl){
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

/**
 * Handles special translation message parts like "newlines as <br>".
**/
function textToNode(input) {
	if(input==='\n') {
		return document.createElement('br')
	return
	}
	return document.createTextNode(input)
}

/**
 * 
**/
function clearElementChilds(xElem){
	while(xElem.firstChild){
		xElem.removeChild(xElem.firstChild)
	}
}

/**
 * 
**/
function createLangTextNode(cssClass, text, lang) {
	const xNode = document.createElement('p')
	xNode.classList.add(cssClass)
	if(lang){
		xNode.setAttribute('lang', lang)
	}
	xNode.appendChild(textToNode(text))
	return xNode
}

/**
 * Clears xDiv and calls func(xDiv), which should add elements to xDiv ("display something").
**/
function replaceContent(xDiv, func){
	// pucgenie: simply use style.display instead of style.visibility="hidden"|"visible" . We don't know anything about the layout beforehand.
	xDiv.style['display'] = 'none'
	clearElementChilds(xDiv)
	func(xDiv)
	xDiv.style['display'] = 'block'
}

/**
 * Should enhance readability a litte bit.
 * Assumes that there exists a customized __ function for translation.
**/
function replaceContentTranslated(xDiv, transKey, params) {
	replaceContent(xDiv, xDiv => __(transKey, params, satz => xDiv.appendChild(textToNode(satz))))
	return xDiv
}

/**
 * Smart-enough XMLHttpRequest-Wrapper (quite dumb).
 * @author pucgenie
**/
function lazyLoad(url, verarbeit, errHand) {
	if(!errHand) {
		errHand = (xhr, progressEvent) => console.debug('Loading [' + url + '], returned status of ' + xhr.status)
	}
	var xhr = new XMLHttpRequest()
	xhr.open('GET', url)
	xhr.onload = function(progressEvent) {
		if (this.status === 200) {
			verarbeit(this.responseText)
		} else {
			errHand(this, progressEvent)
		}
	}
	xhr.send()
}

//helper & utility fns
function display(html){playDiv.innerHTML = html}
