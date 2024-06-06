# 8ai Chatbot Backend

```bash
npm i
```

## Development

```bash
npm run dev
```

## Running Locally

Azure Functions uses Azure Storage to store its data. You can use Azurite, a local emulator for Azure Storage, to run the Functions app locally. Azurite provides a local environment that emulates the Azure Blob, Queue, and Table services for development purposes.

1. Open a new terminal in Visual Studio Code.
2. Run the following command to start Azurite `npx -y azurite --location ./.azurite/data --debug ./.azurite/logs`. This command installs azurite and starts it in the current directory. The --location flag specifies the location of the data, and the --debug flag specifies the location of the logs.
3. Run with vsCode Run and Debug - should start server on `http://localhost:7071/api/`
