#!/bin/sh
#
# Usage: make_new.sh <addonname> version=<flag>
#        ex.
#         $ ./make_new.sh myaddon version=1
#         $ ./make_new.sh myaddon
#
# This script creates two XPI files, <addonname>.xpi and <addonname>_noupdate.xpi.
# If "updateURL" is specified in the install.rdf, it will be removed automatically
# for <addonname>_noupdate.xpi. So, "_noupdate" file can be uplodad to Mozilla Add-ons.
#
# You have to put files in following pattern:
#
#  +[<addonname>]
#    + make_new.sh           : this script
#    + install.rdf
#    + bootstrap.js
#    + chrome.manifest
#    + [chrome]              : jar, etc.
#    + [content]             : XUL, JavaScript
#    + [locale]              : DTD, properties
#    + [skin]                : CSS, images
#    + [defaults]
#    |  + [preferences]
#    |     + <addonname>.js  : default preferences
#    + [components]          : XPCOM components, XPT
#    + [modules]             : JavaScript code modules
#    + [license]             : license documents
#    + [isp]                 : ISP definitions for Thunderbird
#    + [platform]
#       + [WINNT]            : Microsoft Windows specific files
#       |  + chrome.manifest
#       |  + [chrome]
#       |  + [content]
#       |  + [locale]
#       |  + [skin]
#       + [Darwin]           : Mac OS X specific files
#       |  + chrome.manifest
#       |  + [chrome]
#       |  + [content]
#       |  + [locale]
#       |  + [skin]
#       + [Linux]            : Linux specific files
#          + chrome.manifest
#          + [chrome]
#          + [content]
#          + [locale]
#          + [skin]


appname=$1
if [ "$appname" = '' ]
	# スクリプト名でパッケージ名を明示している場合：
	# スクリプトがパッケージ用のファイル群と一緒に置かれている事を前提に動作
#	cd "${0%/*}"
then
	# 引数でパッケージ名を明示している場合：
	# スクリプトがパッケージ用のファイル群のあるディレクトリで実行されていることを前提に動作
	appname="${0##*/}"
	appname="${appname%.sh}"
	appname="${appname%_test}"
fi


version=`grep 'em:version=' install.rdf | sed -r -e 's#em:version=##g' | sed -r -e 's#[ \t\r\n"]##g'`
if [ "$version" = '' ]
then
	version=`grep '<em:version>' install.rdf | sed -r -e 's#</?em:version>##g' | sed -r -e 's#[ \t\r\n"]##g'`
fi
if [ "$version" != '' ]
then
	use_version=`echo "$2" | sed -r -e 's#version=(1|yes|true)#1#ig'`
	if [ "$use_version" = '1' ]; then version_part="-$version"; fi;
fi


xpi_contents="chrome components/*.js components/*.xpt modules isp defaults license platform *.js *.rdf *.manifest *.inf *.cfg *.light"


rm -r -f xpi_temp
rm -f $appname.xpi
rm -f ${appname}_en.xpi
rm -f ${appname}_noupdate.xpi
rm -f ${appname}_noupdate_en.xpi
rm -f $appname.lzh
rm -f $appname-*.xpi
rm -f ${appname}-*_en.xpi
rm -f ${appname}-*_noupdate.xpi
rm -f ${appname}-*_noupdate_en.xpi
rm -f $appname-*.lzh


# create temp files
mkdir -p xpi_temp

for f in ${xpi_contents}; do
	cp -rp --parents ${f} xpi_temp
done

cp -r content ./xpi_temp/
cp -r locale ./xpi_temp/
cp -r skin ./xpi_temp/


# pack platform related resources
if [ -d ./platform ]
then
	cp -r platform ./xpi_temp/
	cd xpi_temp/platform

	rm components/*.idl

	for dirname in *
	do
		if [ -d $dirname/content -o -d $dirname/skin -o -d $dirname/locale ]
		then
			cd $dirname
			mkdir -p chrome
			zip -r -0 chrome/$appname.jar content locale skin -x \*/.svn/\*
			rm -r -f content
			rm -r -f locale
			rm -r -f skin
			cd ..
		fi
	done
	cd ../..
fi


cd xpi_temp
chmod -R 644 *.jar *.js *.light *.inf *.rdf *.cfg *.manifest


# create jar
mkdir -p chrome
zip -r -0 ./chrome/$appname.jar content locale skin -x \*/.svn/\*
if [ ! -f ./chrome/$appname.jar ]
then
	rm -r -f chrome
fi


if [ -f ./install.js ]
then
	cp ../ja.inf ./locale.inf
	cp ../options.$appname.ja.inf ./options.inf
	chmod 644 *.inf
fi


#create xpi (Japanese)
zip -r -9 ../$appname${version_part}.xpi $xpi_contents -x \*/.svn/\* || exit 1

#create xpi without update info (Japanese)
rm -f install.rdf
sed -e "s#^.*<em:*\(updateURL\|updateKey\)>.*</em:*\(updateURL\|updateKey\)>##g" -e "s#^.*em:*\(updateURL\|updateKey\)=\(\".*\"\|'.*'\)##g" ../install.rdf > install.rdf
zip -r -9 ../${appname}${version_part}_noupdate.xpi $xpi_contents -x \*/.svn/\* || exit 1



# create lzh
if [ -f ../readme.txt ]
then
	lha a ../$appname${version_part}.lzh ../$appname.xpi ../readme.txt
fi


#create xpi (English)
if [ -f ./install.js ]
then
	rm -f install.rdf
	rm -f locale.inf
	rm -f options.inf
	cp ../install.rdf ./install.rdf
	cp ../en.inf ./locale.inf
	cp ../options.$appname.en.inf ./options.inf
	chmod 644 *.inf
	zip -r -9 ../${appname}${version_part}_en.xpi $xpi_contents -x \*/.svn/\* || exit 1

	rm -f install.rdf
	sed -e "s#^.*<em:*\(updateURL\|updateKey\)>.*</em:*\(updateURL\|updateKey\)>##g" -e "s#^.*em:*\(updateURL\|updateKey\)=\(\".*\"\|'.*'\)##g" ../install.rdf > install.rdf
	zip -r -9 ../${appname}${version_part}_noupdate_en.xpi $xpi_contents -x \*/.svn/\* || exit 1
fi



#create meta package
if [ -d ../meta ]
then
	rm -f ../meta/$appname.xpi
	cp ../$appname${version_part}.xpi ../meta/$appname.xpi
fi

# end
cd ..
rm -r -f xpi_temp

# create hash
sha1sum -b ${appname}*.xpi > sha1hash.txt

exit 0;
