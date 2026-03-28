export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        agrice: {
          primary: "#2e7d32", // ✅ main green (matches your image)
          light: "#4caf50",
          dark: "#1b5e20",
        },
      },
    },
  },
  plugins: [],
};