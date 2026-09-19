# Digital Evidence Vault

Crie uma aplicação web profissional destinada a REGISTRO TÉCNICO E PRESERVAÇÃO DE EVIDÊNCIAS DIGITAIS para utilização em investigação policial legítima.

IMPORTANTE:
Não criar 11 links. O sistema deverá possuir UMA ÚNICA PÁGINA PÚBLICA e um único link de acesso, cujo conteúdo poderá ser configurado pelo administrador.

OBJETIVO

Quando uma pessoa acessar o link, o sistema deverá registrar, de forma tecnicamente confiável, todas as informações que forem efetivamente disponibilizadas pelo servidor, pela conexão HTTP e pelo navegador.

O sistema não deve inventar, estimar ou falsificar informações. Quando determinado dado não estiver disponível, registrar "não disponível".

LINK ÚNICO

Criar uma única URL pública, por exemplo:

/acesso/[ID-ÚNICO]

O administrador poderá configurar:

título;

imagem;

descrição;

conteúdo apresentado ao visitante;

identificador da investigação;

identificador da campanha;

data de criação;

status ativo/inativo.

REGISTRO DE IP

No momento em que houver uma requisição ao servidor, registrar todos os endereços IP que forem tecnicamente observáveis.

Registrar separadamente:

IPv4;

IPv6;

IP de origem observado diretamente pelo servidor;

IP informado por infraestrutura de proxy/CDN, somente quando houver uma cadeia de proxy confiável;

porta de origem, somente se efetivamente disponibilizada pela infraestrutura;

protocolo utilizado;

HTTP/HTTPS;

versão HTTP, quando disponível.

IMPORTANTE:
Não confiar cegamente em headers como X-Forwarded-For ou similares. O sistema deve identificar se está atrás de proxy/CDN e documentar a origem do IP utilizado.

Não afirmar que IPv4 e IPv6 existem quando somente um deles estiver disponível.

INFORMAÇÕES HTTP

Registrar, quando disponíveis:

User-Agent completo;

Accept;

Accept-Language;

Accept-Encoding;

Referer;

Origin;

Host;

Connection;

DNT;

sec-ch-ua;

sec-ch-ua-mobile;

sec-ch-ua-platform;

demais Client Hints fornecidos pelo navegador;

método HTTP;

caminho solicitado;

timestamp preciso da requisição;

timezone do servidor;

status HTTP retornado.

Preservar os headers originais em formato estruturado para fins de auditoria.

INFORMAÇÕES DO NAVEGADOR

Após o carregamento da página, registrar somente informações disponibilizadas normalmente pelo navegador, como:

navegador;

versão, quando disponível;

sistema operacional/plataforma;

arquitetura, quando disponível;

idioma;

idiomas preferenciais;

resolução da tela;

profundidade de cor;

tamanho da janela;

timezone;

UTC offset;

touch points, quando disponível;

tipo de dispositivo, quando puder ser determinado de forma confiável.

Não utilizar fingerprinting invasivo.

DATA E HORA

Registrar timestamps em UTC utilizando relógio do servidor.

Para cada evento guardar:

timestamp UTC;

timestamp do servidor;

timestamp informado pelo navegador, quando houver;

diferença entre os horários, quando tecnicamente calculável.

GEOLOCALIZAÇÃO

Criar uma seção específica para localização.

A localização do dispositivo somente deverá ser solicitada através da API oficial de geolocalização do navegador e mediante autorização explícita do usuário.

Quando autorizada, registrar:

latitude;

longitude;

precisão em metros;

altitude, se disponível;

precisão da altitude, se disponível;

velocidade, se disponível;

direção/heading, se disponível;

timestamp fornecido pelo dispositivo;

timestamp de recebimento no servidor.

IMPORTANTE:
Não tentar obter localização sem a permissão do navegador.
Não tentar contornar mecanismos de permissão.
Não apresentar uma localização estimada como se fosse localização exata.

CÂMERA

Criar uma seção específica para captura de imagem.

A câmera somente poderá ser utilizada depois que o navegador solicitar e o usuário conceder permissão.

Permitir, quando suportado pelo dispositivo:

câmera frontal;

câmera traseira.

Mostrar claramente uma prévia antes da captura.

A captura deverá exigir ação explícita do usuário.

Registrar:

imagem capturada;

timestamp;

câmera utilizada, quando o navegador informar;

resolução;

formato;

tamanho do arquivo;

hash SHA-256 do arquivo original.

Nunca ativar câmera automaticamente.
Nunca tentar capturar imagem sem autorização.

DADOS DE CONEXÃO

Registrar tudo aquilo que o servidor realmente conseguir observar, incluindo:

IP;

protocolo;

HTTP version;

headers;

User-Agent;

conexão via proxy, quando detectável;

informações fornecidas por CDN/proxy confiável;

timestamp;

método HTTP;

endpoint acessado.

Criar uma seção denominada "Dados não disponíveis" para deixar explícito quais informações não puderam ser obtidas.

PRESERVAÇÃO DA EVIDÊNCIA

Cada acesso deverá receber:

UUID único;

ID da investigação;

ID da sessão;

timestamp UTC;

hash dos arquivos coletados;

hash do conjunto de metadados;

registro de auditoria.

Para imagens e arquivos:

SHA-256;

tamanho original;

MIME type;

extensão;

timestamp de recebimento.

Não modificar o arquivo original após o recebimento.

PAINEL ADMINISTRATIVO

Criar painel protegido por autenticação.

Dashboard:

número total de acessos;

último acesso;

IPv4;

IPv6;

localização autorizada;

imagens autorizadas;

navegador;

sistema operacional;

data/hora;

identificador da sessão.

Ao abrir um evento, mostrar todos os dados disponíveis de forma organizada.

MAPA

Quando houver coordenadas autorizadas, mostrar:

latitude;

longitude;

precisão;

horário da coleta.

Representar visualmente a área correspondente à precisão informada pelo dispositivo.

Não transformar uma coordenada de baixa precisão em uma suposta localização exata.

EXPORTAÇÃO

Permitir exportar uma ocorrência em:

JSON;

CSV;

relatório PDF.

O relatório deverá conter:

IDENTIFICAÇÃO DA OCORRÊNCIA
DATA/HORA
IP
IPV4
IPV6
DADOS HTTP
USER-AGENT
DADOS DO NAVEGADOR
DADOS DO DISPOSITIVO DISPONÍVEIS
GEOLOCALIZAÇÃO AUTORIZADA
DADOS DA CÂMERA AUTORIZADA
HASHES
LOG DE EVENTOS

LOG DE AUDITORIA

Registrar todas as ações realizadas no painel:

login;

visualização;

download;

exportação;

criação;

alteração;

exclusão;

alteração de configurações.

Cada evento deverá possuir timestamp e usuário responsável.

SEGURANÇA

Implementar:

HTTPS;

autenticação forte;

controle de acesso;

proteção contra SQL injection;

proteção contra XSS;

CSRF;

rate limiting;

validação de uploads;

limite de tamanho;

armazenamento privado das imagens;

URLs temporárias para arquivos;

backups;

logs de segurança.

PRECISÃO E TRANSPARÊNCIA

O sistema deve distinguir claramente:

"DADO OBTIDO DIRETAMENTE"

"DADO FORNECIDO PELO NAVEGADOR"

"DADO FORNECIDO PELO SERVIDOR"

"DADO FORNECIDO POR PROXY/CDN"

"DADO NÃO DISPONÍVEL"

Nunca apresentar inferências como fatos.

CONFORMIDADE

A aplicação deverá operar exclusivamente através de mecanismos normais de rede e APIs oficiais do navegador.

Não implementar:

bypass de permissões;

exploração de vulnerabilidades;

ativação clandestina de câmera;

coleta clandestina de localização;

malware;

fingerprinting invasivo;

tentativa de identificar o dispositivo além das informações legitimamente disponibilizadas.

O sistema deve ser projetado para investigação legítima, documentação técnica e preservação de evidências, com controle de acesso e trilha de auditoria.

ARQUITETURA

Utilizar:

frontend responsivo;

backend seguro;

banco de dados relacional;

armazenamento privado para imagens;

API REST;

autenticação administrativa;

sistema de logs;

geração de hashes SHA-256.

Antes de finalizar, teste a aplicação para garantir que:

o IP observado pelo servidor seja registrado corretamente;

IPv4 seja registrado quando disponível;

IPv6 seja registrado quando disponível;

headers sejam preservados;

User-Agent seja preservado;

localização somente seja registrada após autorização;

câmera somente seja utilizada após autorização;

imagens recebidas tenham hash SHA-256;

timestamps sejam armazenados em UTC;

nenhum dado indisponível seja inventado;

os registros possam ser exportados para documentação da investigação.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/51db2a87-81ef-4c64-b932-a535dca4541d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
