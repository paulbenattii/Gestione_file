import os
import zipfile

# Percorso della cartella in cui cercare i file zip
folder_path = "D:\prova"  # Modifica con il percorso della cartella

# Itera su tutti gli elementi all'interno della cartella
for filename in os.listdir(folder_path):
    file_path = os.path.join(folder_path, filename)
    
    # Verifica se l'elemento è un file e se ha l'estensione .zip
    if os.path.isfile(file_path) and filename.lower().endswith('.zip'):
        # Ricava il nome del file senza l'estensione .zip per usarlo come nome della cartella
        folder_name = os.path.splitext(filename)[0]
        extract_path = os.path.join(folder_path, folder_name)
        
        # Crea la cartella di destinazione se non esiste già
        if not os.path.exists(extract_path):
            os.makedirs(extract_path)
            
        print(f"Estrazione di '{filename}' in '{folder_name}'...")
        
        # Procede con l'estrazione
        try:
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_path)
            print(f"-> '{filename}' estratto con successo.")
        except zipfile.BadZipFile:
            print(f"-> Errore: '{filename}' è corrotto o non è un file zip valido.")

print("Estrazione completata!")