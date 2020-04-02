"use strict";
// pucgenie: Coding style: tab-indentation; single-quoted-internal-strings; aligned-control-keywords

window.prompts2 = []

const uebersetz = new Uebersetz('client_messages', uebersetz => {
	if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
		document.addEventListener('DOMContentLoaded', nachDemLaden, {once: true})
	} else {
		nachDemLaden()
	}
})

function nachDemLaden() {
	const nameDiv   = document.getElementById('nameDiv')
	const pointsDiv = document.getElementById('pointsDiv')
	const playDiv   = document.getElementById('playDiv')
	const promptDiv = document.getElementById('promptDiv')
	const inputBox  = document.getElementById('inputBox')
	const langBox   = document.getElementById('langBox')
	const form      = document.getElementById('form')
	
	const choiceBtns = []
	langBox.value = navigator.languages[0]
	document.querySelectorAll('[data-tlk]').forEach(elem => {
		replaceContentTranslated(elem, elem.getAttribute('data-tlk'))
	})
	replaceContentTranslated(playDiv, "ConnectingToServer")
	
	form.addEventListener('submit', evt => {
		evt.preventDefault()
		const txData = {
			promptId: promptDiv.getAttribute("promptid"),
			answer: inputBox.value,
			lang: langBox.value
		}
		if (txData.promptId == 0) {
			txData['color'] = document.getElementById("playerColor").value
		}
		client.sendCmd('receiveAnswer', txData)
		inputBox.value = ""
		// pucgenie: hide form if unused
		form.style['display'] = 'none'
	}, false)
	
	const client = new HFT.GameClient()
	client.on('connect', () => {
		replaceContentTranslated(playDiv, "ConnectedToServer")
		client.sendCmd('userLang', Array.from(uebersetz.languages))
	})

	client.on('disconnect', () => {
		replaceContentTranslated(playDiv, "Disconnected")
	})

	client.on('displayPrompt', prompt => {
		clearElementChilds(playDiv)
		replaceContent(promptDiv, promptDiv => {
			promptDiv.setAttribute("promptid", prompt.id)
			if (prompt.id == 0) {
				uebersetz.__("WhatsYourName", undefined, satz => prompt.prompt = satz)
			}
			const trTxt = window.prompts2[prompt.id]
			if(trTxt){
				// FIXME: translate if [0] === false
				prompt.prompt = trTxt[1]
				if (!trTxt[0]) {
					prompt.prompt = translate(prompt.prompt)
				}
				prompt.lang = window.prompts2Lang
			}
			promptDiv.appendChild(document.createTextNode(prompt.prompt))
			if (prompt.id == 0) {
				if (prompt.resPack){
					const langIter = uebersetz.languages.values()
					const saveParsed = rText => {
						window.prompts2 = JSON.parse(rText)
					}
					const retryHandler1 = (xhr, progressEvent) => {
						if (xhr.status !== 404){
							// pucgenie: assert status === 200
					return
						}
						if(progressEvent !== "bootstrap"){
							// pucgenie: debug or trace?
							console.log(progressEvent, xhr.status)
						}
						// pucgenie: asynchronous loop (some kind of flattened recursion)
						const xLang = langIter.next().value
						if (!xLang){
							// pucgenie: no more language entries. Most likely the controller should use server-provided prompt texts then.
					return
						}
						window.prompts2Lang = xLang
						lazyLoad(`${prompt.resPack}_${xLang}.json`, saveParsed, retryHandler1)
					}
					retryHandler1({status: 404}, "bootstrap")
				}
				const colorpicker = document.createElement('input')
				colorpicker.setAttribute('type', 'color')
				colorpicker.value = prompt.color
				colorpicker.setAttribute('id', 'playerColor')
				promptDiv.appendChild(colorpicker)
			}
			form.style['display'] = 'block'
			inputBox.focus()
		})
	})
	client.on('displayChoice', choices => {
		// pucgenie: hide form in case of timeout
		form.style['display'] = 'none'
		replaceContent(playDiv, playDiv => {
			choiceBtns.length = 0
			const promptId = choices.prompt.id
			const xP = document.createElement('p')
			xP.classList.add('Q2Vote4')
			xP.appendChild(document.createTextNode(choices.prompt.prompt))
			playDiv.appendChild(xP)
			choices.possibilities.forEach((choice, i) => {
				const xBtn = document.createElement('button')
				//xBtn.setAttribute('promptId', promptId)
				xBtn.onclick = event => client.sendCmd('receiveChoice', {
					promptId: promptId,
					index: i
				})
				// pucgenie: should aid TTS
				xBtn.setAttribute('lang', choice.lang)
				
				xBtn.appendChild(document.createTextNode(choice.answer))
				playDiv.appendChild(xBtn)
				playDiv.appendChild(document.createElement('br'))
				if (i < choices.length - 1){
					playDiv.appendChild(replaceContentTranslated(document.createElement('span'), "VoteOr", undefined))
					playDiv.appendChild(document.createElement('br'))
				}
				// added in ascending order (by ID)
				choiceBtns.push(xBtn)
			})
		})
	})

	// pucgenie: TODO: direct HTML or just <br>-support?
	client.on('displayMessage', message => replaceContentTranslated(playDiv, message.template, message.params))
	
	client.on('updateName', name => 
		replaceContent(nameDiv, nameDiv => {
			nameDiv.style['color'] = name.color
			nameDiv.appendChild(document.createTextNode(name.name))
		})
	)

	client.on('updateScore', score => replaceContentTranslated(pointsDiv, "Points", {score: score}))
}
