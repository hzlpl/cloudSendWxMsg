FROM mhart/alpine-node
MAINTAINER lipeilong <xxx@xxx.cn>
ADD app /app
ADD logs /logs
WORKDIR /app
ENTRYPOINT node app.js $httpHostName $host $user $password $database