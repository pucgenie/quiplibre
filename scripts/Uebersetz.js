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
