# Aprire Scan4Reuse nel browser

**URL verificato:** https://scan4reuse-preview.vercel.app

Apri il collegamento in un browser. La landing offre **Plan a delivery** per il modulo logistico, **Pricing** per i prezzi e i calcolatori, e i collegamenti ai concept e al workspace. Anche gli URL diretti https://scan4reuse-preview.vercel.app/pricing e https://scan4reuse-preview.vercel.app/upload sono stati verificati.

Il progetto usa HTML, CSS e JavaScript, con un server HTTP nativo di Node.js. Non usa React, Next.js, Vite o un altro framework. Le dipendenze applicative esterne sono zero; serve Node.js 22 o successivo.

Nella sessione Codex Cloud verificata non è stato esposto un URL di anteprima o uno strumento di inoltro delle porte. Il server locale è stato avviato e controllato con Chromium, ma il suo indirizzo di loopback non è un URL pubblico da aprire dal proprio computer.

## Preparare l’anteprima pubblica

```bash
cd /workspace/scan4reuse
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build:preview
```

L’output è `.local/preview/site`. Il build copia una lista esplicita di 24 file pubblici, inclusi i cinque loghi SDG, e aggiunge la configurazione per l’hosting statico. Non copia il repository, `.git`, `.env`, credenziali, PDF allegati, file caricati o richieste salvate. Il manifesto di verifica è `.local/preview/manifest.json`, fuori dal sito da pubblicare.

La versione pubblica è utilizzabile, con una differenza esplicita:

| Funzione | Anteprima statica | Applicazione Node locale |
| --- | --- | --- |
| Landing, team, contenuti, pricing | Completi | Completi |
| Calcolatori report e commissione | Funzionanti | Funzionanti |
| Modulo logistico e download del brief | Dati in memoria nel browser | Dati salvati sul server |
| Upload, download ed eliminazione file | File in memoria nel browser, fino a 200 MB per sessione | Archivio locale persistente |
| Ricaricamento della pagina | Svuota la prova nel browser | Mantiene i file e le richieste salvati |
| Prenotazioni, pagamenti, messaggi ai corrieri | Non eseguiti | Non eseguiti |

L’anteprima espone questa modalità nella pagina. I dati digitati o selezionati restano nel browser; non vengono inviati a un’API o a un partner logistico.

## Vercel: ottenere l’URL

La CLI ufficiale verificata è Vercel 65.8.0. L’opzione `--temporary` è stata rifiutata in questa sessione; il login è stato completato tramite il flusso OAuth ufficiale. Il progetto separato `scan4reuse-preview` è stato creato ed è disponibile all’URL indicato sopra. I passaggi seguenti permettono di aggiornare o ripetere il deployment.

1. Completa il login tramite il collegamento di autorizzazione mostrato dalla CLI. Se è scaduto, genera un nuovo collegamento con:

   ```bash
   npm exec --yes --package vercel@65.8.0 -- vercel login
   ```

2. Pubblica **solo la cartella generata**, in un progetto di anteprima:

   ```bash
   npm exec --yes --package vercel@65.8.0 -- vercel deploy .local/preview/site --yes --environment preview --project scan4reuse-preview --create-if-missing
   ```

3. Al termine Vercel stampa l’URL HTTPS del deployment. Apri quell’URL nel browser; dalla landing puoi raggiungere Pricing e il planner. Non serve aprire il codice o usare un indirizzo localhost.

Non inviare password o token in chat: il login avviene direttamente su Vercel. Il sito di prova usa un progetto Vercel separato. Al primo deployment Vercel ha assegnato automaticamente l’alias del progetto (`scan4reuse-preview.vercel.app`). Non viene ripubblicato l’ambiente Codex né aggiornato un altro sito o dominio aziendale.

## Netlify Drop: alternativa dal browser

1. Apri **https://app.netlify.com/drop**.
2. Carica la cartella generata `.local/preview/site`, oppure il pacchetto ZIP di anteprima fornito nella chat. Se Netlify richiede un account, completa l’accesso nel suo sito.
3. Al termine del deployment Netlify mostra l’indirizzo HTTPS del nuovo sito su `netlify.app`. Apri quell’indirizzo; il sito funziona interamente come anteprima nel browser.

Usa il pacchetto generato, non l’intera cartella del repository. Non ci sono servizi da collegare o chiavi segrete da inserire per questa anteprima.

## Controlli eseguiti

- `npm ci` completato e 12 test di integrazione passati.
- Server Node e pacchetto statico verificati in Chromium.
- Modulo adattivo, esportazione brief, upload/download/eliminazione e calcolatori verificati.
- Navigazione mobile e layout controllati da 320 a 1440 px.
- Nessun errore JavaScript; nessuna chiamata alle API durante l’uso dell’anteprima statica.
- URL Vercel controllato con richieste HTTPS e Chromium; landing, pricing e upload rispondono con HTTP 200. I percorsi `/.env` e `/api/files` rispondono con HTTP 404: l’archivio locale non è esposto.

Un’anteprima con backend persistente pubblico è un deployment distinto: richiede autenticazione e uno storage persistente adeguato, invece dell’archivio su filesystem della macchina di sviluppo.
