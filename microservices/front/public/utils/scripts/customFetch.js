export function internalFetch(url, method = "GET", body = null) {
    const options = {
        method: method.toUpperCase(),
        credentials: "include",
        mode: "cors",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
    };

    if (options.method !== "GET" && body != null)
        options.body = JSON.stringify(body);

    return fetch(url, options);
}