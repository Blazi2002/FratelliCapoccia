/* =============================================================
   ORARI E CHIUSURE DEL SALONE

   Questo è l'UNICO file da modificare per gli orari.
   Non serve toccare nient'altro: l'indicatore "Aperto ora / Chiuso"
   in home legge da qui.

   Dopo aver modificato: salva, fai commit e push. Online in un minuto.
   ============================================================= */

window.FC_ORARI = {

  /* -----------------------------------------------------------
     1) ORARIO SETTIMANALE
     ['apertura', 'chiusura'] in formato 24h, oppure null = chiuso.
     ----------------------------------------------------------- */
  settimana: {
    domenica:  null,
    lunedi:    ['09:00', '19:00'],
    martedi:   ['09:00', '22:00'],
    mercoledi: ['09:00', '19:00'],
    giovedi:   ['09:00', '19:00'],
    venerdi:   ['09:00', '22:00'],
    sabato:    ['09:00', '19:00']
  },

  /* -----------------------------------------------------------
     2) CHIUSURE
     Tre modi di scrivere una chiusura:

       { giorno: '2026-11-02', nota: 'Corso di formazione' }
           -> un giorno singolo

       { dal: '2026-08-10', al: '2026-08-24', nota: 'Chiusura estiva' }
           -> un periodo, estremi inclusi

       { ogniAnno: '12-25', nota: 'Natale' }
           -> torna ogni anno (mese-giorno), non va aggiornato

     La `nota` è opzionale ma compare nel sito ("Chiuso per ferie…"),
     quindi vale la pena scriverla.

     ATTENZIONE — sotto ci sono già i festivi nazionali italiani.
     Sono attivi perché è l'errore meno grave: se il sito dice
     "chiuso" e invece siete aperti perdete una visita, se dice
     "aperto" e invece è chiuso il cliente trova la serranda giù.
     >>> CANCELLA le righe dei giorni in cui invece lavorate. <<<
     ----------------------------------------------------------- */
  chiusure: [
    { ogniAnno: '01-01', nota: 'Capodanno' },
    { ogniAnno: '01-06', nota: 'Epifania' },
    { pasquetta: true,   nota: 'Pasquetta' },
    { ogniAnno: '04-25', nota: 'Festa della Liberazione' },
    { ogniAnno: '05-01', nota: 'Festa dei Lavoratori' },
    { ogniAnno: '06-02', nota: 'Festa della Repubblica' },
    { ogniAnno: '08-15', nota: 'Ferragosto' },
    { ogniAnno: '11-01', nota: 'Ognissanti' },
    { ogniAnno: '12-08', nota: 'Immacolata' },
    { ogniAnno: '12-25', nota: 'Natale' },
    { ogniAnno: '12-26', nota: 'Santo Stefano' }

    /* Esempi da copiare per le vostre chiusure — togli il commento:

    , { dal: '2026-08-10', al: '2026-08-24', nota: 'Chiusura estiva' }
    , { giorno: '2026-11-02', nota: 'Corso di formazione' }

    */
  ],

  /* -----------------------------------------------------------
     3) ORARI RIDOTTI per un giorno preciso
     Per le mezze giornate: aperti, ma con orario diverso dal solito.
     ----------------------------------------------------------- */
  speciali: [
    /* Esempi — togli il commento e correggi le date:

    { giorno: '2026-12-24', dalle: '09:00', alle: '14:00', nota: 'Vigilia di Natale' },
    { giorno: '2026-12-31', dalle: '09:00', alle: '15:00', nota: 'Ultimo dell’anno' }

    */
  ]
};
