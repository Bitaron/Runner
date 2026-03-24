'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Copy, Check } from 'lucide-react';
import { SUPPORTED_CODE_LANGUAGES, type CodeGenLanguage } from '@apiforge/shared';
import type { ApiRequest, HttpMethod, RequestBodyMode } from '@apiforge/shared';

interface CodeGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ApiRequest;
}

export const CodeGenModal: React.FC<CodeGenModalProps> = ({ isOpen, onClose, request }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<CodeGenLanguage>(SUPPORTED_CODE_LANGUAGES[0]);
  const [copied, setCopied] = useState(false);

  const generateCode = (): string => {
    const method = request.method;
    const url = request.url;
    const headers = request.headers.filter((h) => !h.disabled && h.key);
    const params = request.params.filter((p) => !p.disabled && p.key);
    const body = request.body;

    const urlWithParams = params.length > 0
      ? `${url}${url.includes('?') ? '&' : '?'}${params.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')}`
      : url;

    switch (selectedLanguage.id) {
      case 'curl':
        return generateCurl(method, urlWithParams, headers, body);
      case 'javascript-fetch':
        return generateJsFetch(method, urlWithParams, headers, body);
      case 'javascript-axios':
        return generateJsAxios(method, urlWithParams, headers, body);
      case 'python-requests':
        return generatePythonRequests(method, urlWithParams, headers, body);
      case 'python-httpx':
        return generatePythonHttpx(method, urlWithParams, headers, body);
      case 'go':
        return generateGo(method, urlWithParams, headers, body);
      case 'java-okhttp':
        return generateJavaOkHttp(method, urlWithParams, headers, body);
      case 'php':
        return generatePhp(method, urlWithParams, headers, body);
      case 'ruby':
        return generateRuby(method, urlWithParams, headers, body);
      case 'csharp-httpclient':
        return generateCsharp(method, urlWithParams, headers, body);
      default:
        return generateCurl(method, urlWithParams, headers, body);
    }
  };

  const generateCurl = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let curl = `curl -X ${method} '${url}'`;
    
    headers.forEach((h) => {
      curl += ` \\\n  -H '${h.key}: ${h.value}'`;
    });

    if (body.mode === 'raw' && body.raw) {
      curl += ` \\\n  -d '${body.raw}'`;
    } else if ((body.mode === 'formdata' || body.mode === 'urlencoded') && body.formdata) {
      body.formdata.forEach((f) => {
        if (!f.disabled) {
          curl += ` \\\n  -F '${f.key}=${f.value}'`;
        }
      });
    } else if (body.mode === 'graphql' && body.graphql) {
      curl += ` \\\n  -H 'Content-Type: application/json'`;
      const graphqlBody = JSON.stringify({ query: body.graphql.query, variables: body.graphql.variables ? JSON.parse(body.graphql.variables) : undefined });
      curl += ` \\\n  -d '${graphqlBody}'`;
    }

    return curl;
  };

  const generateJsFetch = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `const response = await fetch('${url}', {\n  method: '${method}',\n`;
    
    if (headers.length > 0) {
      code += `  headers: {\n`;
      headers.forEach((h) => {
        code += `    '${h.key}': '${h.value}',\n`;
      });
      code += `  },\n`;
    }

    if (body.mode === 'raw' && body.raw) {
      code += `  body: JSON.stringify(${body.raw}),\n`;
    } else if (body.mode === 'formdata' && body.formdata) {
      const formData = body.formdata.filter((f) => !f.disabled).map((f) => `    '${f.key}': '${f.value}'`).join(',\n');
      code += `  body: new URLSearchParams({\n${formData}\n  }),\n`;
    }

    code += `});\n\nconst data = await response.json();\nconsole.log(data);`;
    return code;
  };

  const generateJsAxios = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `const axios = require('axios');\n\n`;
    
    const config: Record<string, unknown> = {
      method: method.toLowerCase(),
      url: url,
    };

    if (headers.length > 0) {
      const headersObj: Record<string, string> = {};
      headers.forEach((h) => { headersObj[h.key] = h.value; });
      config.headers = headersObj;
    }

    if (body.mode === 'raw' && body.raw) {
      config.data = JSON.parse(body.raw);
    } else if (body.mode === 'formdata' && body.formdata) {
      const formData = new FormData();
      body.formdata.filter((f) => !f.disabled).forEach((f) => formData.append(f.key, f.value));
      config.data = formData;
    }

    code += `axios(${JSON.stringify(config, null, 2)})\n  .then(response => {\n    console.log(response.data);\n  })\n  .catch(error => {\n    console.error(error);\n  });`;
    
    return code;
  };

  const generatePythonRequests = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `import requests\n\n`;
    
    const headersObj = headers.length > 0
      ? `headers = {\n${headers.map((h) => `    '${h.key}': '${h.value}'`).join(',\n')}\n}\n`
      : '';

    code += headersObj;

    if (body.mode === 'raw' && body.raw) {
      code += `data = ${body.raw}\n`;
      code += `response = requests.${method.toLowerCase()}('${url}', headers=headers, json=data)\n`;
    } else if (body.mode === 'formdata' && body.formdata) {
      const formData = body.formdata.filter((f) => !f.disabled).map((f) => `    '${f.key}': '${f.value}'`).join(',\n');
      code += `data = {\n${formData}\n}\n`;
      code += `response = requests.${method.toLowerCase()}('${url}', headers=headers, data=data)\n`;
    } else {
      code += `response = requests.${method.toLowerCase()}('${url}')\n`;
    }

    code += `print(response.json())`;
    return code;
  };

  const generatePythonHttpx = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `import httpx\n\n`;
    
    const headersObj = headers.length > 0
      ? `headers = {\n${headers.map((h) => `    '${h.key}': '${h.value}'`).join(',\n')}\n}\n`
      : '';

    code += headersObj;
    code += `with httpx.Client() as client:\n`;

    if (body.mode === 'raw' && body.raw) {
      code += `    response = client.${method.toLowerCase()}('${url}', headers=headers, json=${body.raw})\n`;
    } else {
      code += `    response = client.${method.toLowerCase()}('${url}', headers=headers)\n`;
    }

    code += `    print(response.json())`;
    return code;
  };

  const generateGo = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `package main\n\nimport (\n    "bytes"\n    "encoding/json"\n    "fmt"\n    "io"\n    "net/http"\n)\n\nfunc main() {\n`;
    
    if (headers.length > 0 || body.mode === 'raw') {
      code += `    headers := map[string]string{\n`;
      headers.forEach((h) => { code += `        "${h.key}": "${h.value}",\n`; });
      code += `    }\n\n`;
    }

    if (body.mode === 'raw' && body.raw) {
      code += `    body := []byte(\`${body.raw}\`)\n`;
      code += `    req, _ := http.NewRequest("${method}", "${url}", bytes.NewBuffer(body))\n`;
    } else {
      code += `    req, _ := http.NewRequest("${method}", "${url}", nil)\n`;
    }

    if (headers.length > 0) {
      code += `    for key, value := range headers {\n        req.Header.Set(key, value)\n    }\n`;
    }

    code += `\n    client := &http.Client{}\n`;
    code += `    resp, err := client.Do(req)\n`;
    code += `    if err != nil {\n        fmt.Println("Error:", err)\n        return\n    }\n    defer resp.Body.Close()\n\n    body, _ := io.ReadAll(resp.Body)\n    fmt.Println(string(body))\n}`;
    return code;
  };

  const generateJavaOkHttp = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `import okhttp3.*;\nimport java.io.IOException;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        OkHttpClient client = new OkHttpClient();\n\n`;
    
    if (headers.length > 0) {
      code += `        Headers headers = new Headers.Builder()\n`;
      headers.forEach((h) => { code += `                .add("${h.key}", "${h.value}")\n`; });
      code += `                .build();\n\n`;
    }

    if (body.mode === 'raw' && body.raw) {
      code += `        MediaType JSON = MediaType.parse("application/json; charset=utf-8");\n`;
      code += `        RequestBody body = RequestBody.create(JSON, "${body.raw.replace(/"/g, '\\"').replace(/\n/g, '\\n')}");\n`;
      code += `        Request request = new Request.Builder()\n                .url("${url}")\n`;
      if (headers.length > 0) code += `                .headers(headers)\n`;
      code += `                .${method.toLowerCase()}(body)\n`;
    } else {
      code += `        Request request = new Request.Builder()\n                .url("${url}")\n`;
      if (headers.length > 0) code += `                .headers(headers)\n`;
      code += `                .${method.toLowerCase()}()\n`;
    }

    code += `                .build();\n\n`;
    code += `        try (Response response = client.newCall(request).execute()) {\n            System.out.println(response.body().string());\n        }\n    }\n}`;
    return code;
  };

  const generatePhp = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `<?php\n\n`;
    
    code += `$curl = curl_init();\n\n`;
    code += `curl_setopt_array($curl, [\n`;
    code += `    CURLOPT_URL => "${url}",\n`;
    code += `    CURLOPT_RETURNTRANSFER => true,\n`;
    code += `    CURLOPT_CUSTOMREQUEST => "${method}",\n`;
    
    if (headers.length > 0) {
      code += `    CURLOPT_HTTPHEADER => [\n`;
      headers.forEach((h) => { code += `        "${h.key}: ${h.value}",\n`; });
      code += `    ],\n`;
    }

    if (body.mode === 'raw' && body.raw) {
      code += `    CURLOPT_POSTFIELDS => '${body.raw.replace(/'/g, "\\'")}',\n`;
    }

    code += `]);\n\n`;
    code += `$response = curl_exec($curl);\n`;
    code += `$err = curl_error($curl);\n`;
    code += `curl_close($curl);\n\n`;
    code += `if ($err) {\n    echo "Error: " . $err;\n} else {\n    echo $response;\n}`;
    return code;
  };

  const generateRuby = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `require 'net/http'\nrequire 'uri'\nrequire 'json'\n\n`;
    code += `uri = URI.parse("${url}")\n`;
    code += `http = Net::HTTP.new(uri.host, uri.port)\n\n`;
    
    if (headers.length > 0) {
      code += `headers = {\n`;
      headers.forEach((h) => { code += `    '${h.key}' => '${h.value}',\n`; });
      code += `}\n\n`;
    }

    const requestClass = {
      GET: 'Net::HTTP::Get',
      POST: 'Net::HTTP::Post',
      PUT: 'Net::HTTP::Put',
      PATCH: 'Net::HTTP::Patch',
      DELETE: 'Net::HTTP::Delete',
    }[method] || 'Net::HTTP::Get';

    code += `request = ${requestClass}.new(uri)\n`;
    if (headers.length > 0) {
      code += `request.headers = headers\n`;
    }

    if (body.mode === 'raw' && body.raw) {
      code += `request.body = '${body.raw.replace(/'/g, "\\'")}'\n`;
    }

    code += `\nresponse = http.request(request)\n`;
    code += `puts response.body`;
    return code;
  };

  const generateCsharp = (method: HttpMethod, url: string, headers: { key: string; value: string }[], body: RequestBody): string => {
    let code = `using System;\nusing System.Net.Http;\nusing System.Threading.Tasks;\n\nclass Program\n{\n    static async Task Main()\n    {\n        using var client = new HttpClient();\n\n`;
    
    if (headers.length > 0) {
      headers.forEach((h) => {
        code += `        client.DefaultRequestHeaders.Add("${h.key}", "${h.value}");\n`;
      });
      code += `\n`;
    }

    const httpMethod = {
      GET: 'HttpMethod.Get',
      POST: 'HttpMethod.Post',
      PUT: 'HttpMethod.Put',
      PATCH: 'HttpMethod.Patch',
      DELETE: 'HttpMethod.Delete',
    }[method] || 'HttpMethod.Get';

    code += `        var request = new HttpRequestMessage(${httpMethod}, "${url}");\n`;

    if (body.mode === 'raw' && body.raw) {
      code += `        var content = new StringContent("${body.raw.replace(/"/g, '\\"')}", Encoding.UTF8, "application/json");\n`;
      code += `        request.Content = content;\n`;
    }

    code += `\n        var response = await client.SendAsync(request);\n`;
    code += `        var responseBody = await response.Content.ReadAsStringAsync();\n`;
    code += `        Console.WriteLine(responseBody);\n    }\n}`;
    return code;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Code Generation" size="xl">
      <div className="space-y-4">
        <Select
          label="Language"
          value={selectedLanguage.id}
          onChange={(e) => setSelectedLanguage(SUPPORTED_CODE_LANGUAGES.find((l) => l.id === e.target.value) || SUPPORTED_CODE_LANGUAGES[0])}
          options={SUPPORTED_CODE_LANGUAGES.map((l) => ({
            value: l.id,
            label: l.variant ? `${l.name} (${l.variant})` : l.name,
          }))}
        />

        <div className="relative">
          <pre className="p-4 bg-[#1e1e1e] border border-[#3d3d3d] rounded-md overflow-x-auto max-h-96">
            <code className="text-sm font-mono text-gray-200 whitespace-pre">{generateCode()}</code>
          </pre>
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
