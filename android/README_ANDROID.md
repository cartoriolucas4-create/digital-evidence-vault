# MCR Android

O projeto Android do MCR foi integrado ao mesmo repositório e funciona como um aplicativo nativo Android com WebView controlada, carregando a versão publicada do sistema em HTTPS.

## Arquitetura

- App Android nativo: `android/`
- Conteúdo principal: `https://truth-log.lovable.app/`
- Backend/autenticação/dados: continuam sendo os mesmos do sistema web.
- Não existe banco paralelo no APK.
- A WebView mantém JavaScript, DOM Storage, upload de arquivos, câmera e geolocalização mediante permissões do Android e do site.
- Navegação externa é enviada ao navegador do dispositivo; o domínio do MCR permanece dentro do aplicativo.
- Retrato e paisagem são suportados.
- O botão Voltar usa o histórico da WebView e exige segundo toque para sair quando não há histórico.

## Galaxy Tab S6 Lite

O aplicativo usa a mesma interface responsiva do site e deixa o Android fornecer a largura/altura reais da tela. O modo retrato/paisagem não é bloqueado, evitando uma versão separada do sistema.

## Gerar APK

No GitHub Actions, o workflow `.github/workflows/android-apk.yml` é executado automaticamente quando arquivos de `android/` mudam ou pode ser executado manualmente.

Ele gera:

- APK Debug: instalável para testes.
- APK Release: gerado sem assinatura de produção até que uma chave de assinatura seja configurada.

O build usa JDK 17, Gradle 9.6 e Android Gradle Plugin 9.4.0.

## Assinatura

Não coloque uma chave privada de assinatura no repositório. Para uma release de produção, configure um keystore como segredo do GitHub Actions e adicione uma etapa de assinatura usando os secrets. O mesmo keystore deve ser preservado para futuras atualizações do aplicativo.

## Instalação no tablet

1. Baixe o APK Debug produzido pelo workflow.
2. Transfira para o Galaxy Tab S6 Lite.
3. Abra o APK.
4. Se o Android solicitar, permita instalação dessa fonte.
5. Instale e abra o MCR.
6. Entre com o mesmo e-mail e senha usados no site.

## Notificações

O site possui Web Push no navegador. O APK desta primeira integração não finge que Web Push do navegador é equivalente a FCM nativo: a entrega de notificações nativas em segundo plano ainda precisa de uma integração Android/FCM ligada ao backend de notificações. A interface e o backend atuais não são substituídos por uma implementação simulada.

## Permissões

O APK declara:

- Internet — necessária para o sistema web.
- Câmera — somente quando a funcionalidade do site solicitar câmera.
- Localização aproximada/precisa — somente quando a funcionalidade do site solicitar geolocalização.

A permissão de armazenamento amplo não é solicitada.

## Evolução

A estrutura permite adicionar posteriormente:

- Firebase Cloud Messaging (FCM);
- notificações nativas em segundo plano;
- deep links;
- assinatura de release;
- AAB para Google Play;
- integração nativa adicional sem duplicar o banco ou a autenticação.
