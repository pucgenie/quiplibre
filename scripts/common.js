"use strict";

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

/*
 * Should enhance readability a litte bit.
 * Assumes that there exists a customized __ function for translation.
 */
function replaceContentTranslated(xDiv, transKey, params) {
	replaceContent(xDiv, xDiv => __(transKey, params, satz => xDiv.appendChild(textToNode(satz))))
	return xDiv
}
