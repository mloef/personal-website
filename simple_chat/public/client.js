class Chat {
    constructor(chatboxId) {
        this.chatbox = document.getElementById(chatboxId);
        this.messages = [];
        this._buffer = '';
        this.processedIndex = 0;


        return new Proxy(this, {
            set: (target, property, value, receiver) => {
                if (property === 'buffer') {
                    Reflect.set(target, '_buffer', value, receiver); // Set the value first
                    this.onBufferChange(); // Call the function when the buffer changes
                    return true;
                }
                return Reflect.set(target, property, value, receiver);
            }
        });
    }

    onBufferChange() {
        if (this.buffer) {
            this.updateLastMessage("Claude: " + this.buffer);
            this.maybeSpeak();
        }
    }

    speak(text) {
        const speech = new SpeechSynthesisUtterance();
        speech.rate = 1.25;
        speech.onstart = () => {
            console.timeEnd('t2s lag');
            console.timeEnd('total');
        };

        speech.onend = () => {
            console.timeEnd('t2s lag'); //just in case
            console.log('ended speech');
        }

        console.log("Saying out loud: " + text);
        speech.text = text;

        console.log('started speech');
        window.speechSynthesis.speak(speech);
    }

    finishSpeaking() {
        const remaining = this.buffer.slice(this.processedIndex);
            this.processedIndex = this.buffer.length;
            this.speak(remaining);
    }


    maybeSpeak() {
        const words = this.buffer.slice(this.processedIndex).split(' ');
        const passage = words.slice(0, words.length - 1).join(' ')

        if (this.processedIndex == 0 && words.length > 1) {
            this.processedIndex = passage.length;
            this.speak(passage);
        } else if (words.length > 1){
            if (!window.speechSynthesis.speaking || passage.length > 2 * this.processedIndex) {
                this.processedIndex += passage.length;
                this.speak(passage);
            }
        }

    }


    updateLastMessage(message) {
        const messageNode = this.chatbox.lastChild;
        messageNode.textContent = message;
    }

    set buffer(value) {
        this._buffer = value;
    }

    get buffer() {
        return this._buffer;
    }


    sendMessage(message) {
        this.addMessage("User:  " + message)
        this.askLLM(message);
    }

    addMessage(message) {
        const messageNode = document.createElement('p');
        messageNode.textContent = message;
        this.chatbox.appendChild(messageNode);
        this.chatbox.scrollTop = this.chatbox.scrollHeight;

        this.messages.push(message);
    }



    askLLM(message) {
        // Make a POST request to the server's LLM endpoint
        fetch('/llm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message }),
        })
            .then(response => {
                this.addMessage("Claude: ");
                // Read the response as text
                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                //let data = '';


                // Read and parse the chunks as they arrive
                return reader.read().then(function readChunk({ done, value }) {
                    if (done) return;

                    // Decode the chunk
                    var data = decoder.decode(value, { stream: true });

                    // Split by double newline, as SSE format dictates
                    let events = data.split('\r\n');
                    /*const last = events[events.length - 1];
                    if (last[last.length - 1] != '\n') {
                        data = events.pop(); // Save the last (possibly incomplete) event for later
                    }*/

                    // Process the complete events
                    events.forEach(event => {
                        // Split by newline to separate event name and data
                        let lines = event.split('\n');
                        let eventData = lines.find(line => line.startsWith('data: '));
                        if (eventData) {
                            // Extract the JSON part after "data: "
                            let jsonString = eventData.slice(6);
                            let jsonObject = JSON.parse(jsonString);
                            // Handle the data as needed
                            if (jsonObject.completion) {
                                this.buffer += jsonObject.completion;
                            }
                        }
                    });
                    return reader.read().then(readChunk.bind(this));
                }.bind(this));
            })
            .then(() => {
                console.log('finishing')
                this.finishSpeaking();
                this.buffer = '';
                this.processedIndex = 0;
            })
            .catch((error) => {
                console.error('Error:', error);
            })
    }

    messageCount() {
        return this.messages.length;
    }
}

const chat = new Chat('chatbox');

// Start speech recognition using the browser's speech recognition API
function startSpeechRecognition() {
    var speechRec = new webkitSpeechRecognition();
    speechRec.lang = 'en-US';
    speechRec.continuous = true;
    speechRec.start();
    console.log("Speech recognition started");

    speechRec.onstart = () => {
        console.log("I'm listening");
    };

    speechRec.onend = () => {
        console.log("I've stopped listening");
        startSpeechRecognition();
    };

    speechRec.onerror = (event) => {
        console.log("Error while listening: " + event.error);
    };

    speechRec.onresult = (event) => {
        //console.time('s2t');
        console.time('total');
        //console.timeEnd('s2t')
        const final_transcript = event.results[event.results.length - 1][0].transcript;

        console.log("Voice recognition: '" + (final_transcript) + "'");

        // Empty? https://github.com/C-Nedelcu/talk-to-chatgpt/issues/72
        if (final_transcript.trim() == "") {
            console.log("Empty sentence detected, ignoring");
            return;
        }

        // Send the message
        chat.sendMessage(final_transcript);
    };
}


// Perform initialization after jQuery is loaded
function initScript() {
    if (typeof $ === null || typeof $ === undefined) $ = jQuery;

    var warning = "";
    if ('webkitSpeechRecognition' in window) {
        console.log("Speech recognition API supported");
    } else {
        alert("[Goose] Sorry, but speech recognition was not able to load. The script cannot run. Try using Google Chrome or Edge on Windows 11");
        return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function (stream) {
                console.log('Microphone permission granted');
                startSpeechRecognition();
            })
            .catch(function (err) {
                console.log('Microphone permission denied: ' + err);
            });
    } else {
        console.log('getUserMedia not supported');
    }
}

// MAIN ENTRY POINT
// Load jQuery, then run initialization function
(function () {
    typeof jQuery == "undefined" ?
        alert("[Goose] Sorry, but jQuery was not able to load. The script cannot run. Try using Google Chrome or Edge on Windows 11") :
        initScript();

})();