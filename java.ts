import parser from './java-class-parser';
import decompress from 'adm-zip';
import * as fs from 'fs';

export function loadClasses(jarPath: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
        fs.rmdirSync("temp", { recursive: true });
        const zip = new decompress(jarPath);
        zip.extractAllTo("temp");
        const classes = findClassFiles("temp");
        console.log(classes);
        let classMap: any = {};
        // Batch into 4
        let classBatches = [];
        for (let i = 0; i < classes.length; i += 4) {
            classBatches.push(classes.slice(i, i + 4));
        }
        const batchSize = 16;
        for (let i = 0; i < classBatches.length; i+=batchSize) {
            console.log(i/batchSize, '/', classBatches.length/batchSize, classMap.length);
            const batch = classBatches.slice(i, i + batchSize);
            const parsed = await Promise.all(batch.map(parseClass));
            for (let i = 0; i < parsed.length; i++) {
                const parsedBatch = parsed[i];
                for (let i = 0; i < parsedBatch.length; i++) {
                    const parsedClass = parsedBatch[i];
                    classMap[parsedClass.name] = parsedClass;
                }
            }
        }
        resolve(classMap);
    });
}

function parseClass(paths: string[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
        parser(paths, '-p', function(err: any, rs: any[]) {
            if (err) {
                reject(err);
            } else {
                // The result is a map of class names to class objects, convert to a list
                let list = [];
                for (let [key, value] of Object.entries(rs)) {
                    list.push(value);
                }
                resolve(list);
            }
        });
    });
}

function findClassFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(findClassFiles(file));
        } else {
            if(file.endsWith(".class")) {
                results.push(file);
            }
        }
    });
    return results;
}