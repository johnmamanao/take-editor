type StoredVideo = {
  file: File;
  sourceId: string;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('take-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function backgroundFile(file?: File | null): Promise<File | null> {
  const database = await open();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        'assets',
        file === undefined ? 'readonly' : 'readwrite',
      );
      const store = transaction.objectStore('assets');
      let value: File | null = file ?? null;
      if (file === undefined) {
        const request = store.get('background');
        request.onsuccess = () => {
          value = request.result ?? null;
        };
      } else if (file) store.put(file, 'background');
      else store.delete('background');
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function storeVideo(file: File | null, sourceId = '') {
  const database = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assets', 'readwrite');
      if (file) {
        const stored: StoredVideo = { file, sourceId };
        transaction.objectStore('assets').put(stored, 'video');
      } else transaction.objectStore('assets').delete('video');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function restoreVideo(): Promise<StoredVideo | null> {
  const database = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction('assets')
        .objectStore('assets')
        .get('video');
      request.onsuccess = () => {
        const value = request.result as StoredVideo | File | undefined;
        if (!value) resolve(null);
        else if (value instanceof File) resolve({ file: value, sourceId: '' });
        else resolve(value);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
