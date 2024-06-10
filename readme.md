# Proxai

<img src="./static/logo.webp" style="width:256px;height:256px">

A failover proxy for use with APIs that are compatible with the Open AI API.

See: https://ollama.com/blog/openai-compatibility

## Usage

### Create config

create a config.json file

```json
{
  "sticky": false,
  "random": true,
  "servers": [
    {
      "name": "remote:groq",
      "url": "https://api.groq.com/openai/v1/chat/completions",
      "key": "API KEY",
      "model": "llama3-70b-8192"
    },
    {
      "name": "newtwork:ollama",
      "url": "http://192.168.1.176:11434/v1/chat/completions",
      "key": "",
      "model": "llama3:latest"
    },
    ...
  ]
}
```

```shell
proxai --port 8095 <path to config>
```
