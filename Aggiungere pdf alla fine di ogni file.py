import os

def rinomina_file(cartella):
    # Cambia la directory corrente alla cartella specificata
    os.chdir(cartella)
    
    # Elenco dei file nella cartella
    for filename in os.listdir('.'):
        # Controlla se è un file
        if os.path.isfile(filename):
            # Controlla se il file non ha già l'estensione .pdf
            if not filename.lower().endswith('.pdf'):
                # Crea il nuovo nome del file
                nuovo_nome = f"{filename}.pdf"
                
                # Controlla se il nuovo nome esiste già
                if not os.path.exists(nuovo_nome):
                    os.rename(filename, nuovo_nome)  # Rinomina il file
                    print(f"Rinominato: {filename} -> {nuovo_nome}")
                else:
                    print(f"Il file {nuovo_nome} esiste già. Ignorato: {filename}.")
            else:
                print(f"Il file {filename} è già un PDF. Nessuna modifica.")

# Specifica il percorso della cartella da rinominare
percorso_cartella = r'C:\TUTTO\Università\ANALISI MATEMATICA 2\Esercitazioni'  # Usa r per gestire i backslash
rinomina_file(percorso_cartella)
