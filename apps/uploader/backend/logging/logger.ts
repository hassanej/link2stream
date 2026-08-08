type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function write(level: LogLevel, message: string) {
    const timestamp = new Date().toISOString();

    console.log(
        `[${timestamp}] [${level}] ${message}`
    );
}

export const logger = {
    info(message: string) {
        write("INFO", message);
    },

    warn(message: string) {
        write("WARN", message);
    },

    error(message: string) {
        write("ERROR", message);
    },

    debug(message: string) {
        write("DEBUG", message);
    }
};