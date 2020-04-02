"use strict";

/**
 * We want to have one reliable source of user preferred languages in order.
**/
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
	// add base language of first locale as fallback
	navigator.languages.push(navigator.languages[0].substring(0, 2))
}

class Uebersetz {
	constructor(filename, callback) {
		this.ui_messages = {}
		lazyLoad('locales.json', locList => {
			const availLocs = JSON.parse(locList)
			this.languages = new Set(availLocs.filter(value => navigator.languages.includes(value)))
			if(this.languages.size == 0){
				this.languages.addAll(availLocs.filter(value => navigator.languages.map(x => x.substring(0, 2)).includes(value)))
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
	 * @author pucgenie
	**/
	__(key, basis, funcOut) {
		//console.log({"lookup": key, "langs": langs})
		let ret
		let usedLang
		for (let altLang of this.languages) {
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
			for(let txtTeil of ret){
				if(!txtTeil) {
					console.log("Skipping useless (null or undefined) part of " + txtImpl)
			continue
				}
				if(Array.isArray(txtTeil)){
					funcOut(eval("basis." + txtTeil[0]))
			continue
				}
				funcOut(txtTeil)
			}
		} else {
			funcOut(ret)
		}
	return usedLang
	}
}

/**
 * Handles special translation message parts like "newlines as <br>".
**/
function textToNode(input) {
	if(input==='\n') {
	return document.createElement('br')
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
function createLangTextNode(cssClass, textArr, lang) {
	const xNode = document.createElement('p')
	xNode.classList.add(cssClass)
	if(lang){
		xNode.setAttribute('lang', lang)
	}
	textArr.forEach(txtP => xNode.appendChild(textToNode(txtP)))
	return xNode
}

/**
 * Clears xDiv and calls func(xDiv), which should add elements to xDiv ("display something").
**/
function replaceContent(xDiv, func, clearBefore=true){
	// pucgenie: simply use style.display instead of style.visibility="hidden"|"visible" . We don't know anything about the layout beforehand.
	xDiv.style['display'] = 'none'
	if (clearBefore){
		clearElementChilds(xDiv)
	}
	func(xDiv)
	xDiv.style['display'] = 'block'
	return xDiv
}

/**
 * Should enhance readability a litte bit.
 * Assumes that there exists a uebersetz instance for translation.
**/
function replaceContentTranslated(xDiv, transKey, params, clearBefore=true) {
	return replaceContent(xDiv, xDiv => xDiv.setAttribute('lang', uebersetz.__(transKey, params, satz => xDiv.appendChild(textToNode(satz)))), clearBefore)
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
