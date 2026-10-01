# Backoffice — catalogo, ordini, inventario

**Status:** bozza. Nessuna riga scritta. Serve a non perdere i pezzi, non a decidere tutto.
**Repo:** `restheart-cloud-starter-ecommerce`. Tocca anche `ulabase.setup.ts`, non solo il frontend.

## Perché

Oggi il negozio vende e basta. Chi lo gestisce apre la console di Ulabase e modifica
documenti a mano: aggiungere un prodotto, vedere gli ordini, segnare che il 23 è partito. Va bene
per provare, non per usare — e la console è uno strumento da sviluppatore, non da chi imballa
pacchi.

Serve una parte gestionale dentro l'app: **semplice**, non un ERP.

## Cosa c'è già

- `/app` con `AuthGuard`: Home segnaposto, teams, account. È il posto naturale dove appenderlo.
- Le collection le crea l'initializer del plugin: `catalog`, `orders`, `transactions`.
- I permessi attuali sono **solo per gli ospiti**: `catalog-read-anon` (GET, con
  `readFilter: {purchasable: true}`), `orders-create-anon` (POST), `orders-read-anon`
  (GET di un singolo ordine, filtrato sul `secret`).
- Nessuno oggi può **scrivere** su `catalog` o leggere l'elenco degli ordini, se non l'admin del
  servizio.

## Il punto da non sbagliare: `status` non è la spedizione

Il campo `status` sull'ordine appartiene alla macchina a stati **del pagamento**, ed è del plugin:
`pending_payment` → `paid` | `failed` | `expired`, mossa dai webhook di Stripe, più rimborsi e
dispute che si accodano in `transactions`.

**La gestione della spedizione deve avere un campo suo** — qualcosa come
`fulfilment: { status, updatedAt, trackingNumber, note }`. Scriverla dentro `status` produce due
guai, entrambi silenziosi:

1. un webhook in ritardo sovrascrive `shipped` con `paid`, e l'ordine risulta di nuovo da
   spedire;
2. chi gestisce il negozio può, per errore o meno, mettere `paid` a mano su un ordine che nessuno
   ha pagato.

La documentazione del plugin lo dice già per i clienti — *"grant POST and GET only, or a customer
can PATCH their own order to `status: paid`"*. Vale identico per lo staff.

## I pezzi

### 1. Un ruolo, e i permessi che lo accompagnano

Serve un ruolo — `staff`, o `shop-admin` — e le regole ACL che gli danno:

- scrittura su `catalog` (creare, modificare, ritirare un prodotto);
- lettura dell'**elenco** degli ordini, che oggi nessuno ha;
- scrittura sul **solo** sotto-documento `fulfilment`, con `bson-request-whitelist`, mai su
  `status` né sugli importi.

Tutto questo va in `ulabase.setup.ts`, così chi clona lo starter se lo ritrova configurato.

### 2. Catalogo

Elenco, crea, modifica, ritira. Il ritiro è `purchasable: false`, non una cancellazione: un
ordine passato punta a quel prodotto e deve continuare a poterlo leggere.

Attenzione ai campi: sono **snake_case** (`unit_amount`, `image_url`) e `unit_amount` è un intero
in centesimi. Un form che scrive `25.00` produce un prodotto che `CatalogReader` rifiuta di
vendere.

### 3. Ordini

Elenco con filtro per stato, dettaglio, e il passaggio di stato di spedizione. Da mostrare: chi ha
comprato (email, anche per gli ospiti), cosa, quanto, lo stato del pagamento e quello della
spedizione, e le `transactions` collegate quando c'è un rimborso.

### 4. Inventario

Una quantità sul prodotto, decrementata quando un ordine viene pagato.

## Punti aperti

**L'inventario impedisce la vendita, o la mostra e basta?** Impedirla davvero significa un
controllo lato server al momento del checkout: il client non può essere l'unico a saperlo, o due
persone comprano contemporaneamente l'ultimo pezzo. E il decremento va fatto **quando arriva il
webhook**, non quando parte il checkout, altrimenti un carrello abbandonato prosciuga il magazzino.
Se questo è troppo per uno starter, la versione onesta è mostrare la scorta e non promettere che
sia vincolante — ma va scritto, non lasciato intendere.

**Chi diventa staff, e come?** Un ruolo che nessuno può assegnare non serve. Le opzioni sono un
campo sul documento utente messo a mano la prima volta, oppure appoggiarsi ai team — chi è `owner`
del team è staff. La seconda è più elegante e tira dentro la gestione dei team, che c'è già.

**Il backoffice vive in `/app` o su un prefisso suo?** In `/app` è meno lavoro e riusa la shell.
Un `/admin` separato si difende meglio ed è più chiaro a chi guarda le rotte.

**Multi-negozio?** L'app ha i team. Un catalogo per team è una cosa diversa da un catalogo solo.
Probabilmente fuori scope, ma decidere ora evita di scoprirlo dopo.

**Quanto ci mettiamo dentro?** Il rischio di questo pezzo è che diventi il grosso dello starter.
Il negozio si spiega in due minuti; un gestionale no. Meglio poco e finito che tanto e a metà.

## Fuori scope, per ora

- Rimborsi avviati dall'app. Si fanno dalla dashboard di Stripe e il webhook li registra.
- Spedizioni con corriere, etichette, tracking automatico.
- Report e statistiche.
- Import/export del catalogo in CSV.
