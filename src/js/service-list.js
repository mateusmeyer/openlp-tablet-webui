
export async function listServiceItems() {
    const url = apiUrl + '/api/service/list';
    return $.ajax({
        async: false,
        contentType: 'application/json',
        dataType: 'json',
        url
    });
}