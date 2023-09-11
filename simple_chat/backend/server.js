const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const { Transform } = require('stream');

const app = express();
const port = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = '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';

app.use(express.json());
app.use(express.static('public')); // public is the folder that will contain your client-side files

conversation = 'Human: Please limit your responses to five words or less.\n\nAssistant: I will aim for brief responses under five words.\n\n';

app.post('/llm', (req, res) => {
    const { message } = req.body;
    conversation += `Human: ${message}\n\nAssistant: `;
    console.log(conversation);
    
    const requestOptions = {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Anthropic-Version': '2023-06-01',
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
            model: 'claude-instant-1',
            prompt: conversation,
            max_tokens_to_sample: 100,
            stream: true,
        }),
    };

    const responseTransform = new Transform({
        transform(chunk, encoding, callback) {
            console.log(chunk.toString());
            callback(null, chunk);
        },
    });

    console.time('anthropic');
    fetch('https://api.anthropic.com/v1/complete', requestOptions)
        .then((response) => {
            response.body.pipe(responseTransform).pipe(res);
            console.timeEnd('anthropic');
        })
        .catch((error) => {
            console.error('Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        })
});

// Serve static files from the public directory at the root of the application
app.use('/', express.static(path.join(__dirname, '../public')));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
