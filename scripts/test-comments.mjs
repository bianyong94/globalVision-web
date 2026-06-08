import { fetchMovieComments, fetchMovieDetail } from "../services/api.ts"

async function main() {
  try {
    const detail = await fetchMovieDetail("E8VqN")
    console.log("detail id:", detail?.id, detail?.name)
    const comments = await fetchMovieComments("E8VqN")
    console.log("comments total:", comments.total)
    console.log("comments list length:", comments.list.length)
    console.log("first comment:", JSON.stringify(comments.list[0], null, 2))
  } catch (error) {
    console.error("error:", error)
    process.exitCode = 1
  }
}

main()
