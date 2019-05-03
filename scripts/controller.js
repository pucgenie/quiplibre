// pucgenie: Coding style: tab-indentation; single-quoted-internal-strings; aligned-control-keywords

const uebersetz = new Uebersetz('client_messages.json', uebersetz => {
	window.__ = (key, basis, func, joined) => uebersetz.__(uebersetz.languages, key, basis, func, joined)
	lazyLoad(`Quiplash/content/QuiplashQuestion_${uebersetz.languages[0]}.jet`, rText => {
		window.prompts2 = JSON.parse(rText)
	})
	if (document.readyState !== 'complete') {
		document.addEventListener('DOMContentLoaded', nachDemLaden, {once: true})
	} else {
		nachDemLaden()
	}
})

function nachDemLaden() {
	const nameDiv = document.getElementById('nameDiv')
	const pointsDiv = document.getElementById('pointsDiv')
	const playDiv = document.getElementById('playDiv')
	const promptDiv = document.getElementById('promptDiv')
	const inputBox = document.getElementById('inputBox')
	const langBox = document.getElementById('langBox')
	const form = document.getElementById('form')
	
	const choiceBtns = []
	langBox.value = navigator.languages[0]
	document.querySelectorAll('[data-tlk]').forEach(elem => {
		replaceContentTranslated(elem, elem.getAttribute('data-tlk'))
	})
	replaceContentTranslated(playDiv, "ConnectingToServer")
	
	form.addEventListener('submit', evt => {
		evt.preventDefault()
		var txData = {
			promptId: promptDiv.getAttribute("promptid"),
			answer: inputBox.value,
			// pucgenie: TODO: sollte auswählbar gemacht werden
			lang: langBox.value
		}
		if (txData.promptId == 0) {
			txData['color'] = document.getElementById('playerColor').getAttribute('color')
		}
		client.sendCmd('receiveAnswer', txData)
		inputBox.value = ""
		// pucgenie: hide form if unused
		form.style['display'] = 'none'
	}, false)
	
	const client = new HFT.GameClient()
	client.on('connect', () => {
		replaceContentTranslated(playDiv, "ConnectedToServer")
		client.sendCmd('userLang', {languages: navigator.languages})
	})

	client.on('disconnect', () => {
		replaceContentTranslated(playDiv, "Disconnected")
	})

	client.on('displayPrompt', prompt => {
		clearElementChilds(playDiv)
		replaceContent(promptDiv, promptDiv => {
			promptDiv.setAttribute("promptid", prompt.id)
			promptDiv.appendChild(document.createTextNode(prompt.prompt))
			if (prompt.id == 0) {
				var colorpicker = document.createElement('input')
				colorpicker.setAttribute('type', 'color')
				colorpicker.setAttribute('color', prompt.color)
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
			var promptId = choices.prompt.id
			var xP = document.createElement('p')
			xP.classList.add('Q2Vote4')
			xP.appendChild(document.createTextNode(choices.prompt.prompt))
			playDiv.appendChild(xP)
			choices.possibilities.forEach((choice, i) => {
				var xBtn = document.createElement('button')
				//xBtn.setAttribute('promptId', promptId)
				xBtn.onclick = event => client.sendCmd('receiveChoice', {
					promptId: promptId,
					index: i
				})
				// pucgenie: should aid TTS
				xBtn.setAttribute('lang', choice.lang)
				
				xBtn.appendChild(document.createTextNode(choice))
				playDiv.appendChild(xBtn)
				playDiv.appendChild(document.createElement('br'))
				if (i < choices.length - 1){
					var langedSpan = document.createElement('span')
					langedSpan.setAttribute('lang', __("VoteOr", undefined, satz => langedSpan.appendChild(textToNode(satz))))
					playDiv.appendChild(langedSpan)
					playDiv.appendChild(document.createElement('br'))
				}
				// added in ascending order (by ID)
				choiceBtns.push(xBtn)
			})
		})
	})

	// pucgenie: TODO: direct HTML or just <br>-support?
	client.on('displayMessage', message => {
		replaceContentTranslated(playDiv, message.template, message.params)
	})
	
	client.on('updateName', name => {
		replaceContent(nameDiv, nameDiv => {
			nameDiv.style['color'] = name.color
			nameDiv.appendChild(document.createTextNode(name.name))
		})
	})

	client.on('updateScore', score => replaceContentTranslated(pointsDiv, "Points", {score: score}))
}
