# Proxai

<img src="./static/logo.webp" style="width:256px;height:256px">

## Overview

Proxai is a failover proxy designed for use with APIs that are compatible with the OpenAI API. It allows you to seamlessly switch between different AI model providers, ensuring high availability and flexibility in your AI-powered applications.

Key features:

- Support for multiple AI providers
- Failover capability
- Configurable routing (sticky or random)
- Easy integration with OpenAI-compatible APIs

## Installation

### Option 1: Install globally via npm

To install Proxai globally as a CLI tool, you can use npm:

```shell
npm install -g proxai
```

This will make the `proxai` command available system-wide.

### Option 2: Local installation

If you prefer to install Proxai locally or work with the source code:

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/proxai.git
   cd proxai
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. (Optional) To make the `proxai` command available locally, you can link the package:
   ```
   npm link
   ```

## Usage

1. Create a configuration file (e.g., `config.json`) with your API settings:

```json
{
  "sticky": false,
  "random": true,
  "servers": [
    {
      "name": "remote:groq",
      "url": "https://api.groq.com/openai/v1/chat/completions",
      "key": "YOUR_GROQ_API_KEY",
      "model": "llama3-70b-8192"
    },
    {
      "name": "network:ollama",
      "url": "http://192.168.1.176:11434/v1/chat/completions",
      "key": "",
      "model": "llama3:latest"
    }
  ]
}
```

2. Start the Proxai server:

```shell
proxai --port 8095 /path/to/your/config.json
```

3. Use the proxy in your application by pointing your OpenAI-compatible API calls to `http://localhost:8095` (or the appropriate host and port).

### Common Scenarios

1. **Using multiple AI providers**: Configure multiple servers in your `config.json` to leverage different AI providers.

2. **Local development**: Use Proxai to switch between local and remote AI models during development.

3. **High availability**: Set up multiple servers to ensure your application can fall back to alternative providers if one becomes unavailable.

## Configuration

Proxai is configured using a JSON file. Here are the available settings:

- `sticky` (boolean): If true, requests will stick to the same server until it fails.
- `random` (boolean): If true, a random server will be chosen for each request.
- `servers` (array): List of server configurations.
  - `name` (string): A unique identifier for the server.
  - `url` (string): The API endpoint URL.
  - `key` (string): The API key for authentication (if required).
  - `model` (string): The default model to use for this server.

Example configuration:

```json
{
  "sticky": true,
  "random": false,
  "servers": [
    {
      "name": "primary",
      "url": "https://api.primary-ai.com/v1/chat/completions",
      "key": "primary-api-key",
      "model": "gpt-4"
    },
    {
      "name": "secondary",
      "url": "https://api.secondary-ai.com/v1/chat/completions",
      "key": "secondary-api-key",
      "model": "gpt-3.5-turbo"
    }
  ]
}
```

## API Reference

Proxai acts as a transparent proxy, so you can use it with any OpenAI-compatible API client. The endpoint will be the Proxai server address instead of the direct AI provider URL.

Example using the OpenAI Node.js library:

```javascript
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: "your-api-key",
  basePath: "http://localhost:8095", // Proxai server address
});

const openai = new OpenAIApi(configuration);

async function main() {
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Hello, how are you?" }],
  });

  console.log(completion.data.choices[0].message);
}

main();
```

## Contributing

We welcome contributions to Proxai! Here are some guidelines:

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure your code lints (we use ESLint).
4. Issue a pull request with a comprehensive description of changes.

### Code Style

- We follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).
- Use 2 spaces for indentation.
- Use semicolons at the end of each statement.
- Use single quotes for strings.

### Testing

- Write unit tests for new features using Jest.
- Ensure all tests pass before submitting a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support and Contact

For support, please open an issue on the GitHub repository. For direct inquiries, you can reach out to [your-email@example.com].

---

We hope you find Proxai useful for your AI-powered applications. If you have any questions or need further assistance, don't hesitate to reach out!
