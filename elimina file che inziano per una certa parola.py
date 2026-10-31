import os

# Specifica il percorso della cartella
cartella = "D:\Telefono"

def elimina_file_trashed(cartella):
    try:
        # Itera su tutti i file nella cartella specificata
        for file in os.listdir(cartella):
            percorso_completo = os.path.join(cartella, file)
            
            # Verifica che sia un file e che inizi con ".trashed"
            if os.path.isfile(percorso_completo) and file.startswith(".trashed"): #inserisci con cosa devonno iniziare i file che vuoi eliminare
                os.remove(percorso_completo)
                print(f"File eliminato: {percorso_completo}")
        
        print("Eliminazione completata.")
    except Exception as e:
        print(f"Errore: {e}")

# Chiama la funzione
elimina_file_trashed(cartella)