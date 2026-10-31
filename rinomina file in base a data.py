import os
import time
from collections import defaultdict

# Percorso della cartella con i file
folder_path = r"D:\[02] File Multimediali\[02] Telefono"  # Modifica con il percorso effettivo della tua cartella

# Dizionario per raggruppare i file per data
files_by_date = defaultdict(list)

# Raggruppa i file per data
for filename in os.listdir(folder_path):
    file_path = os.path.join(folder_path, filename)
    if os.path.isfile(file_path):
        # Ottieni la data di modifica del file
        creation_time = os.path.getmtime(file_path)
        formatted_date = time.strftime("%Y-%m-%d", time.localtime(creation_time))
        # Aggiungi il file al gruppo della sua data
        files_by_date[formatted_date].append((file_path, creation_time))

# Rinominazione dei file
for date, files in files_by_date.items():
    # Ordina i file per orario
    files.sort(key=lambda x: x[1])  # Ordina per timestamp
    for i, (file_path, creation_time) in enumerate(files, start=1):
        # Estrai l'estensione del file
        file_extension = os.path.splitext(file_path)[1]
        # Crea il nuovo nome con data e numero progressivo
        new_filename = f"{date}[{i}]{file_extension}"
        new_file_path = os.path.join(folder_path, new_filename)

        # Verifica se il nome esiste già e incrementa il numero progressivo se necessario
        counter = i
        while os.path.exists(new_file_path):
            counter += 1
            new_filename = f"{date}[{counter}]{file_extension}"
            new_file_path = os.path.join(folder_path, new_filename)

        # Rinomina il file
        os.rename(file_path, new_file_path)

print("Rinominazione completata!")
