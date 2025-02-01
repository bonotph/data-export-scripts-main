filename = "src/fastq/input_data/input.txt"

print('\nEnter the input data (one line per sample). Type "exit" to finish:\n')
with open(filename, "w") as file:
    while True:
        line = input()
        if line == "exit":
            break
        if line.strip():  # Ignore empty lines
            file.write(line.strip() + "\n")