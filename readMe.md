环境变量参数
httpHostName:http服务器地址
host:mysql数据库地址
user:mysql数据库用户名
password:mysql数据库密码
database:mysql数据库名称

镜像使用方式
docker run -ti -e httpHostName=参数1 -e host=参数2 -e user=参数3 -e password=参数4 -e database=参数5 镜像名称
