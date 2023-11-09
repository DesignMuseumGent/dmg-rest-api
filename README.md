# Design Museum Gent - RESTful API
This repository contains the documentation for the RESTful API of the Design Museum Gent. The API allows users to access various data catalogues (DCAT) containing metadata related to the collection and programming of [Design Museum Gent](https://designmuseumgent.be). To ensure a healthy upstream, this API relies on the [dmg-resolver](https://github.com/designmuseumgent/dmg-resolver) service. 

![rest-api structure](https://github.com/DesignMuseumGent/dmg-rest-api/assets/43210443/40618cc8-2197-4a12-8d80-0eabec1d40b1)

## documentation
for further documentation on how to use the REST-API and which catalogues are available, a [swagger documentation](https://data.designmuseumgent.be/api-docs) has been setup. 

## run service 
to setup the API make sure Node is installed on your device. 

### clone the repository 
```
git clone https://github.com/designmuseumgent/dmg-rest-api/
```

### install dependencies 
open the directory where the project was cloned and install dependencies:
```
npm install --save
```

### run the API locally 
to start the API localy use the following command: 
```
node app.js
```

the api is now running at localhost:PORT (PORT defined in .env)

